"""Coordinate dataset preparation, model execution, scoring, and run persistence."""

import traceback
import uuid
from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from time import perf_counter
from typing import Any

import pandas as pd

from .artifacts import environment, write_json
from .config import ExperimentConfig, ModelConfig
from .contracts import PREDICTION_SCHEMA, Classifier, prediction_input, training_input
from .datasets import fingerprint, prepare_data
from .metrics import evaluate, select_threshold, threshold_sweep
from .models import create_model
from .reporting import render_report

ModelFactory = Callable[[ModelConfig, int], Classifier]


@dataclass
class RunState:
    """Mutable state shared by the stages of one experiment."""

    directory: Path
    metadata: dict[str, Any]
    model: Classifier | None = None

    @property
    def classifier(self) -> Classifier:
        """Return the initialized model or report an invalid execution order."""
        if self.model is None:
            raise RuntimeError("Model has not been initialized")
        return self.model


def predict_checked(model: Classifier, frame: pd.DataFrame) -> pd.DataFrame:
    """Validate model output IDs before joining predictions with reference labels."""
    predictions = PREDICTION_SCHEMA.validate(
        model.predict(prediction_input(frame)), lazy=True
    )
    if set(predictions.comment_id) != set(frame.comment_id):
        raise ValueError("Model output IDs differ from the requested input IDs")
    columns = [
        "comment_id",
        "dataset_id",
        "consultation_group",
        "comment_text",
        "productive",
        "label_quality",
        "split",
    ]
    truth = frame.filter(items=columns).rename(
        columns={"productive": "productive_true"}
    )
    return truth.merge(predictions, on="comment_id", validate="one_to_one")


def _start(config: ExperimentConfig) -> RunState:
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
    run_id = f"{timestamp}-{config.name}-{uuid.uuid4().hex[:8]}"
    directory = config.output_dir / run_id
    directory.mkdir(parents=True, exist_ok=False)
    metadata: dict[str, Any] = {
        "run_id": run_id,
        "name": config.name,
        "model": config.model.kind,
        "status": "running",
        "started_at": datetime.now(timezone.utc).isoformat(),
        "environment": environment(),
        "warnings": [],
        "artifacts_version": 1,
    }
    write_json(directory / "config.json", config.model_dump(mode="json"))
    write_json(directory / "run.json", metadata)
    return RunState(directory, metadata)


def _selection(
    frame: pd.DataFrame, split: str, *, labelled: bool = False
) -> pd.DataFrame:
    mask = frame.split.eq(split)
    if labelled:
        mask &= frame.productive.notna()
    return pd.DataFrame(frame.loc[mask, :]).copy()


def _prepare(config: ExperimentConfig, state: RunState) -> pd.DataFrame:
    frame, manifest = prepare_data(config.data, seed=config.seed)
    write_json(state.directory / "splits.json", manifest)
    columns = [
        "comment_id",
        "dataset_id",
        "consultation_group",
        "source_sha256",
        "comment_text",
        "record_kind",
        "productive",
        "label_quality",
        "label_scope",
        "split",
    ]
    frame.filter(items=columns).to_parquet(
        state.directory / "dataset.parquet", index=False
    )
    state.metadata.update(
        dataset_fingerprint=manifest["dataset_fingerprint"],
        scope=config.data.scope,
        reference_quality=config.data.reference_quality,
    )
    return frame


def _describe_test(
    config: ExperimentConfig, state: RunState, test: pd.DataFrame
) -> None:
    if test.empty:
        raise ValueError("No test records. Check the dataset and split configuration.")
    state.metadata["evaluation_fingerprint"] = fingerprint(
        test,
        ["comment_id", "comment_text", "productive", "label_scope", "label_quality"],
    )
    warnings = state.metadata["warnings"]
    if test.productive.dropna().nunique() != 2:
        warnings.append("Test set contains only one reference class.")
    if config.data.include_candidates:
        warnings.append(
            "Unreviewed candidate blocks may contain report prose or fragments."
        )
    if config.data.include_silver_train:
        warnings.append("Training may include assumption-based silver positives.")


def _fit(state: RunState, train: pd.DataFrame, validation: pd.DataFrame) -> None:
    model = state.classifier
    if model.requires_training and train.productive.nunique() != 2:
        raise ValueError(
            (
                "Training requires positive and negative labelled examples. "
                "Silver positives alone are insufficient."
            )
        )
    started = perf_counter()
    model.fit(training_input(train), training_input(validation))
    state.metadata["fit_seconds"] = perf_counter() - started


def _threshold(
    config: ExperimentConfig, state: RunState, validation: pd.DataFrame
) -> float:
    if not config.tune_threshold:
        return config.threshold
    predictions = predict_checked(state.classifier, validation)
    predictions.to_parquet(
        state.directory / "validation_predictions.parquet", index=False
    )
    threshold_sweep(predictions).to_csv(
        state.directory / "validation_thresholds.csv", index=False
    )
    return select_threshold(predictions, config.threshold_fn_cost_ratio)


def _save_results(
    config: ExperimentConfig, state: RunState, predictions: pd.DataFrame
) -> None:
    predictions.to_parquet(state.directory / "predictions.parquet", index=False)
    predictions.to_csv(state.directory / "predictions.csv", index=False)
    metrics, costs = evaluate(
        predictions, config.fn_cost_ratios, config.inference_cost_per_1000_usd
    )
    metrics["reference_quality"] = config.data.reference_quality
    write_json(state.directory / "metrics.json", metrics)
    costs.to_csv(state.directory / "cost_sensitivity.csv", index=False)
    threshold_sweep(predictions).to_csv(
        state.directory / "test_thresholds_descriptive.csv", index=False
    )
    failed = metrics["n_failed"]
    state.metadata["status"] = (
        "failed"
        if failed == len(predictions)
        else "completed_with_errors" if failed else "completed"
    )
    if failed:
        state.metadata["warnings"].append(
            "Prediction failures are saved; inspect coverage alongside quality metrics."
        )
    if state.metadata["status"] == "failed":
        state.metadata["error"] = (
            "Every test prediction failed; inspect model/raw_responses.jsonl"
        )


def _execute(config: ExperimentConfig, state: RunState, factory: ModelFactory) -> None:
    frame = _prepare(config, state)
    test = _selection(frame, "test")
    _describe_test(config, state, test)
    state.model = factory(config.model, config.seed)
    validation = _selection(frame, "validation", labelled=True)
    _fit(state, _selection(frame, "train", labelled=True), validation)
    threshold = _threshold(config, state, validation)
    state.metadata["threshold"] = threshold
    started = perf_counter()
    predictions = predict_checked(state.classifier, test)
    scored = predictions.score.notna() & predictions.error.isna()
    predictions.loc[scored, "productive"] = (
        predictions.loc[scored, "score"].ge(threshold).astype("boolean")
    )
    state.metadata["predict_seconds"] = perf_counter() - started
    _save_results(config, state, predictions)


def _finish(state: RunState, started: float) -> None:
    if state.model is not None:
        try:
            state.model.save(state.directory / "model")
        # Keep a failed run reviewable even when its provider cannot serialize state.
        except Exception as exc:  # pylint: disable=broad-exception-caught
            state.metadata.update(
                status="failed", artifact_error=f"{type(exc).__name__}: {exc}"
            )
    state.metadata.update(
        elapsed_seconds=perf_counter() - started,
        finished_at=datetime.now(timezone.utc).isoformat(),
    )
    write_json(state.directory / "run.json", state.metadata)
    render_report(state.directory)


def run_experiment(
    config: ExperimentConfig, model_factory: ModelFactory = create_model
) -> Path:
    """Run one experiment and preserve its report even if a model fails."""
    state = _start(config)
    started = perf_counter()
    try:
        _execute(config, state, model_factory)
    # Adapters are plugins; arbitrary failures are part of the saved run result.
    except Exception as exc:  # pylint: disable=broad-exception-caught
        state.metadata.update(status="failed", error=f"{type(exc).__name__}: {exc}")
        (state.directory / "traceback.txt").write_text(
            traceback.format_exc(), encoding="utf-8"
        )
    finally:
        _finish(state, started)
    return state.directory
