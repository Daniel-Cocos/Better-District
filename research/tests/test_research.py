"""Regression checks for benchmark models, splitting and run artifacts."""

import io
import json
from types import SimpleNamespace

import pandas as pd
import pytest

from research.config import DataConfig, ExperimentConfig, ModelConfig, load_config
from research.datasets import prepare_data
from research.metrics import evaluate, select_threshold
from research.models.base import BaseClassifier
from research.models.baselines import AlwaysPositive
from research.models.llm import ZeroShotClassifier
from research.reporting import compare_runs, render_report
from research.runner import run_experiment


@pytest.fixture(name="research_frame")
def sample_research_data(monkeypatch):
    """Provide sample research data behavior for this test."""
    rows = []
    for dataset_id in [
        "s77446_carparks",
        "psg29_portswood_log",
        "s50527_licensing",
        "s69290_budget",
    ]:
        for i in range(6):
            positive = i % 2 == 0
            text = (
                (
                    f"{dataset_id} crossing {i} should be safer because cars "
                    "turn across pedestrians."
                )
                if positive
                else f"{dataset_id} {i} stupid idiots!"
            )
            rows.append(
                {
                    "comment_id": f"{dataset_id}_{i}",
                    "dataset_id": dataset_id,
                    "comment_text": text,
                    "source_sha256": "a" * 64,
                    "record_kind": "candidate",
                    "productive": positive,
                    "label_quality": "reviewed",
                    "label_scope": "constructive_feedback",
                }
            )
    frame = pd.DataFrame(rows)
    frame["productive"] = frame.productive.astype("boolean")
    monkeypatch.setattr("research.datasets.load_dataset", lambda *a, **k: frame.copy())
    return frame


def test_consultation_splits_freeze_and_silver_is_train_only(research_frame, tmp_path):
    """Consultation splits freeze and silver is train only."""
    research_frame.loc[
        research_frame.dataset_id.eq("s69290_budget"), "label_quality"
    ] = "silver"
    frame, manifest = prepare_data(DataConfig())
    assert frame.groupby("consultation_group").split.nunique().eq(1).all()
    assert frame.loc[frame.split.eq("test"), "productive"].isna().all()
    split_file = tmp_path / "splits.json"
    split_file.write_text(json.dumps(manifest))
    reloaded, _ = prepare_data(DataConfig(splits_file=split_file))
    pd.testing.assert_frame_equal(frame, reloaded)
    research_frame.loc[0, "comment_text"] = "Changed input"
    with pytest.raises(ValueError, match="fingerprint"):
        prepare_data(DataConfig(splits_file=split_file))


def test_duplicate_labelled_text_cannot_cross_splits(research_frame):
    """Duplicate labelled text cannot cross splits."""
    research_frame.loc[
        research_frame.dataset_id.eq("s69290_budget").idxmax(), "comment_text"
    ] = research_frame.iloc[0].comment_text
    with pytest.raises(ValueError, match="crosses split"):
        prepare_data(DataConfig())


@pytest.mark.usefixtures("research_frame")
def test_end_to_end_reports_and_comparison(tmp_path):
    """End to end reports and comparison."""
    config = ExperimentConfig(
        name="baseline", output_dir=tmp_path, model=ModelConfig(kind="always_positive")
    )
    directory = run_experiment(config)
    run = json.loads((directory / "run.json").read_text())
    assert run["status"] == "completed"
    metrics = json.loads((directory / "metrics.json").read_text())
    assert metrics["recall"] == 1
    assert metrics["precision"] == 0.5
    assert (directory / "report.html").exists()
    assert (directory / "figures/confusion.png").exists()
    assert (directory / "figures/confusion.svg").exists()
    before = (directory / "metrics.json").read_text()
    render_report(directory)
    assert before == (directory / "metrics.json").read_text()
    config.model = ModelConfig(kind="heuristic")
    config.name = "heuristic"
    second = run_experiment(config)
    assert compare_runs([directory, second], tmp_path / "comparison").exists()
    metadata_path = second / "run.json"
    meta = json.loads(metadata_path.read_text())
    meta["scope"] = "licensing_legal_validity"
    metadata_path.write_text(json.dumps(meta))
    with pytest.raises(ValueError, match="identical evaluation"):
        compare_runs([directory, second], tmp_path / "bad-scope")
    meta["scope"] = "constructive_feedback"
    meta["evaluation_fingerprint"] = "different"
    metadata_path.write_text(json.dumps(meta))
    with pytest.raises(ValueError, match="identical evaluation"):
        compare_runs([directory, second], tmp_path / "bad-comparison")


def test_runner_never_injects_officer_responses_or_test_labels(
    research_frame, tmp_path
):
    """Runner never injects officer responses or test labels."""

    class Spy(AlwaysPositive):
        """Provide spy behavior for this test."""

        def fit(self, train, validation):
            """Fit the adapter using training labels and optional validation data."""
            assert set(train.columns) == {"comment_id", "comment_text", "productive"}
            assert not train.comment_id.str.startswith("s69290").any()
            assert not validation.comment_id.str.startswith("s69290").any()

        def predict(self, comments):
            """Return schema-validated predictions for the supplied comment inputs."""
            assert set(comments.columns) == {"comment_id", "comment_text"}
            return super().predict(comments)

    research_frame["officer_response"] = "Secret council response"
    config = ExperimentConfig(
        name="spy", output_dir=tmp_path, model=ModelConfig(kind="always_positive")
    )
    directory = run_experiment(config, model_factory=lambda *a: Spy())
    assert json.loads((directory / "run.json").read_text())["status"] == "completed"
    assert "officer_response" not in pd.read_parquet(directory / "dataset.parquet")


def test_failed_training_keeps_report(research_frame, tmp_path):
    """Failed training keeps report."""
    research_frame["productive"] = True
    config = ExperimentConfig(
        name="single-class", output_dir=tmp_path, model=ModelConfig(kind="lightgbm")
    )
    directory = run_experiment(config)
    run = json.loads((directory / "run.json").read_text())
    assert run["status"] == "failed"
    assert "positive and negative" in run["error"]
    assert (directory / "traceback.txt").exists()
    assert (directory / "report.html").exists()


@pytest.mark.usefixtures("research_frame")
def test_lightgbm_trains_and_saves_model(tmp_path):
    """Lightgbm trains and saves model."""
    config = ExperimentConfig(
        name="lightgbm",
        output_dir=tmp_path,
        model=ModelConfig(kind="lightgbm", params={"n_estimators": 2}),
    )
    directory = run_experiment(config)
    assert json.loads((directory / "run.json").read_text())["status"] == "completed"
    assert (directory / "model/model.joblib").exists()


def test_litellm_local_request_and_invalid_json_preserves_raw(monkeypatch):
    """Litellm local request and invalid json preserves raw."""
    import litellm

    captured = []

    def completion(**kwargs):
        """Provide completion behavior for this test."""
        captured.append(kwargs)
        return SimpleNamespace(
            choices=[
                SimpleNamespace(
                    message=SimpleNamespace(
                        content='{"productive":true,"reason":"specific issue"}'
                    )
                )
            ],
            usage=SimpleNamespace(prompt_tokens=12, completion_tokens=8),
            model_dump=lambda **k: {"answer": "raw response"},
        )

    monkeypatch.setattr(litellm, "completion", completion)
    model = ZeroShotClassifier(model_name="my-local-model", reasoning_effort="none")
    frame = pd.DataFrame(
        [{"comment_id": "one", "comment_text": "Please improve this crossing."}]
    )
    result = model.predict(frame)
    assert result.productive.iloc[0]
    assert captured[0]["model"] == "ollama_chat/my-local-model"
    assert captured[0]["reasoning_effort"] == "none"
    assert captured[0]["api_base"] == "http://localhost:11434"
    assert captured[0]["response_format"] == {"type": "json_object"}
    assert result.input_tokens.iloc[0] == 12

    def bad_completion(**kwargs):
        """Provide bad completion behavior for this test."""
        response = completion(**kwargs)
        response.choices[0].message.content = (
            '{"productive":"false","reason":"bad type"}'
        )
        return response

    monkeypatch.setattr(litellm, "completion", bad_completion)
    result = model.predict(frame)
    assert result.productive.isna().all()
    assert result.error.notna().all()
    assert model.raw[-1]["response"] == {"answer": "raw response"}


def test_laya_wire_protocol(monkeypatch):
    """Laya wire protocol."""
    from research.models.laya import LayaClassifier
    from research.models import laya

    def respond(request, **_kwargs):
        """Provide respond behavior for this test."""
        body = json.loads(request.data)
        assert body["state"] == {"body": "Safer crossing please"}
        assert body["questions"]["productivity"]["type"] == "choice"
        return io.BytesIO(
            json.dumps(
                {
                    "answers": {
                        "productivity": {
                            "choice": "productive",
                            "probabilities": {"productive": 0.8, "unproductive": 0.2},
                        }
                    },
                    "usage": {"input_tokens": 10, "output_tokens": 0},
                }
            ).encode()
        )

    monkeypatch.setattr(laya, "urlopen", respond)
    result = LayaClassifier(
        model_name="english", api_base="http://localhost:8000"
    ).predict(
        pd.DataFrame([{"comment_id": "one", "comment_text": "Safer crossing please"}])
    )
    assert result.score.iloc[0] == 0.8


def test_unknown_labels_and_failures_remain_visible():
    """Unknown labels and failures remain visible."""
    frame = pd.DataFrame(
        {
            "productive_true": pd.Series([True, False, pd.NA, True], dtype="boolean"),
            "productive": pd.Series([True, True, False, pd.NA], dtype="boolean"),
            "score": [0.8, 0.7, 0.2, None],
            "error": [None, None, None, "failed"],
            "latency_ms": [1.0, 2.0, 3.0, 4.0],
            "input_tokens": [None] * 4,
            "output_tokens": [None] * 4,
        }
    )
    metrics, costs = evaluate(frame)
    assert metrics["n_scored"] == 2
    assert metrics["n_failed_labelled"] == 1
    assert metrics["n_unknown"] == 1
    assert metrics["recall"] == 1
    assert metrics["recall_with_failed_positives_missed"] == 0.5
    assert metrics["estimated_test_cost_usd"] is None
    assert costs.iloc[-1].total_cost == 1
    with pytest.raises(ValueError, match="successful prediction"):
        select_threshold(frame)


def test_config_env_override_and_typos(tmp_path, monkeypatch):
    """Config env override and typos."""
    path = tmp_path / "config.yaml"
    path.write_text(
        (
            "name: local\nmodel:\n  kind: zero_shot\n  params:\n    "
            "model_name: ollama_chat/${OLLAMA_MODEL}\n"
        )
    )
    monkeypatch.delenv("OLLAMA_MODEL", raising=False)
    with pytest.raises(ValueError, match="Unresolved"):
        load_config(path)
    assert (
        load_config(path, "ollama_chat/my-model").model.params["model_name"]
        == "ollama_chat/my-model"
    )
    with pytest.raises(ValueError):
        ExperimentConfig.model_validate(
            {"name": "bad", "model": {"kind": "heuristic"}, "threshhold": 0.7}
        )


@pytest.mark.usefixtures("research_frame")
def test_all_failed_inference_is_a_failed_run_with_saved_predictions(tmp_path):
    """All failed inference is a failed run with saved predictions."""

    class Broken(BaseClassifier):
        """Provide broken behavior for this test."""

        def predict_one(self, text):
            """Classify a single comment without accessing its reference label."""
            raise ConnectionError("Local model unavailable")

    config = ExperimentConfig(
        name="unavailable",
        output_dir=tmp_path,
        model=ModelConfig(kind="always_positive"),
    )
    directory = run_experiment(config, model_factory=lambda *a: Broken())
    assert json.loads((directory / "run.json").read_text())["status"] == "failed"
    predictions = pd.read_parquet(directory / "predictions.parquet")
    assert predictions.productive.isna().all()
    assert predictions.error.str.contains("Local model unavailable").all()
    assert json.loads((directory / "metrics.json").read_text())["coverage"] == 0


@pytest.mark.usefixtures("research_frame")
def test_threshold_selection_uses_validation_not_test(tmp_path):
    """Threshold selection uses validation not test."""

    class Scored(BaseClassifier):
        """Provide scored behavior for this test."""

        def predict_one(self, text):
            """Classify a single comment without accessing its reference label."""
            score = 0.8 if "because" in text else 0.2
            return {"productive": score >= 0.5, "score": score}

    config = ExperimentConfig(
        name="threshold",
        output_dir=tmp_path,
        tune_threshold=True,
        model=ModelConfig(kind="always_positive"),
    )
    directory = run_experiment(config, model_factory=lambda *a: Scored())
    metadata = json.loads((directory / "run.json").read_text())
    assert metadata["status"] == "completed"
    assert metadata["threshold"] == 0.5
    validation = pd.read_parquet(directory / "validation_predictions.parquet")
    assert validation.consultation_group.eq("licensing").all()
    assert (directory / "validation_thresholds.csv").exists()


def test_encoder_requests_float32_and_trains_without_downloads(monkeypatch, tmp_path):
    """Encoder requests float32 and trains without downloads."""
    import torch
    import transformers
    from research.models.deberta import DebertaClassifier

    class Tiny(torch.nn.Module):
        """Provide tiny behavior for this test."""

        def __init__(self):
            super().__init__()
            self.classifier = torch.nn.Linear(1, 2)
            self.config = SimpleNamespace(_commit_hash="test-commit")

        def forward(self, input_ids, labels=None):
            """Provide forward behavior for this test."""
            logits = self.classifier(input_ids.float())
            loss = (
                torch.nn.functional.cross_entropy(logits, labels)
                if labels is not None
                else None
            )
            return SimpleNamespace(logits=logits, loss=loss)

        def save_pretrained(self, path):
            """Provide save pretrained behavior for this test."""
            path.mkdir(parents=True)
            (path / "config.json").write_text("{}")

    class Tokenizer:
        """Provide tokenizer behavior for this test."""

        def __call__(self, texts, **kwargs):
            if isinstance(texts, str):
                texts = [texts]
            return transformers.BatchEncoding(
                {"input_ids": torch.tensor([[len(t.split())] for t in texts])}
            )

        def save_pretrained(self, path):
            """Provide save pretrained behavior for this test."""
            (path / "tokenizer_config.json").write_text("{}")

    def pretrained(*_args, **kwargs):
        # HF now infers the checkpoint's fp16 dtype unless explicitly overridden.
        """Provide pretrained behavior for this test."""
        assert kwargs["dtype"] == torch.float32
        return Tiny().to(dtype=kwargs["dtype"])

    monkeypatch.setattr(
        transformers.AutoModelForSequenceClassification, "from_pretrained", pretrained
    )
    monkeypatch.setattr(
        transformers.AutoTokenizer, "from_pretrained", lambda *a, **k: Tokenizer()
    )
    frame = pd.DataFrame(
        {
            "comment_id": ["a", "b"],
            "comment_text": ["because roads are unsafe", "idiots"],
            "productive": [True, False],
        }
    )
    model = DebertaClassifier(epochs=1, batch_size=2)
    model.fit(frame, frame.iloc[:0])
    predictions = model.predict(frame.filter(items=["comment_id", "comment_text"]))
    assert predictions.error.isna().all()
    assert model.metadata["training_dtype"] == "torch.float32"
    model.save(tmp_path)
    assert (tmp_path / "checkpoint/tokenizer_config.json").exists()


def test_dspy_compilation_receives_only_train_and_validation(monkeypatch, tmp_path):
    """Dspy compilation receives only train and validation."""
    import dspy
    from research.models.dspy import DSPyClassifier

    captured = {}

    # This test double implements only the external method under test.
    class Optimizer:  # pylint: disable=too-few-public-methods
        """Provide optimizer behavior for this test."""

        def __init__(self, **kwargs):
            captured["optimizer"] = kwargs

        def compile(self, program, **kwargs):
            """Provide compile behavior for this test."""
            captured.update(kwargs)
            return program

    monkeypatch.setattr(dspy, "MIPROv2", Optimizer)
    model = DSPyClassifier(model_name="mock-local-model")
    train = pd.DataFrame(
        {
            "comment_id": ["a", "b"],
            "comment_text": ["useful comment", "bare abuse"],
            "productive": [True, False],
        }
    )
    validation = pd.DataFrame(
        {"comment_id": ["v"], "comment_text": ["validation only"], "productive": [True]}
    )
    model.fit(train, validation)
    assert [x.comment for x in captured["trainset"]] == train.comment_text.tolist()
    assert [x.comment for x in captured["valset"]] == validation.comment_text.tolist()
    assert set(captured["trainset"][0].inputs().keys()) == {"comment"}
    model.save(tmp_path)
    assert (tmp_path / "compiled_program.json").exists()


def test_ai_reference_labels_are_used_only_when_selected(research_frame):
    """Ai reference labels are used only when selected."""
    research_frame["label_quality"] = "ai_reference"
    frame, _ = prepare_data(DataConfig(reference_quality="ai_reference"))
    assert frame.productive.notna().all()
    frame, _ = prepare_data(DataConfig(include_candidates=True))
    assert frame.loc[frame.split.eq("test"), "productive"].isna().all()


def test_stratified_benchmark_split_is_repeatable_and_keeps_duplicates_together(
    monkeypatch,
):
    """Stratified benchmark split is repeatable and keeps duplicates together."""
    rows = []
    for i in range(120):
        rows.append(
            {
                "comment_id": f"unit{i}",
                "dataset_id": "s77446_carparks",
                "comment_text": f"Response {i // 2}",
                "source_sha256": "a" * 64,
                "record_kind": "comment",
                "productive": bool((i // 2) % 2),
                "label_quality": "ai_reference",
                "label_scope": "constructive_feedback",
            }
        )
    frame = pd.DataFrame(rows)
    monkeypatch.setattr("research.datasets.load_dataset", lambda *a, **k: frame.copy())
    config = DataConfig(reference_quality="ai_reference", split_strategy="stratified")
    first, _ = prepare_data(config)
    second, _ = prepare_data(config)
    pd.testing.assert_frame_equal(first, second)
    assert first.groupby("comment_text").split.nunique().eq(1).all()
    assert set(first.split) == {"train", "validation", "test"}
    assert first.groupby("split").productive.nunique().eq(2).all()


def test_laya_loads_pinned_local_weights_and_classifies_without_a_server(
    monkeypatch, tmp_path
):
    """Laya loads pinned local weights and classifies without a server."""
    import huggingface_hub
    import laya
    from research.models.laya import LayaClassifier, REVISION

    captured = {}

    # This test double implements only the inference method under test.
    class Agent:  # pylint: disable=too-few-public-methods
        """Provide agent behavior for this test."""

        device = "cpu"
        cfg = {}

        def predict_long(self, state, questions, *, window):
            """Provide predict long behavior for this test."""
            assert state == {"body": "Keep the first hour free."}
            assert window == 512
            assert questions["productivity"]["type"] == "choice"
            return {
                "answers": {
                    "productivity": {
                        "choice": "productive",
                        "probabilities": {"productive": 0.9, "unproductive": 0.1},
                    }
                },
                "usage": {"input_tokens": 20, "output_tokens": 0},
            }

    def snapshot(_model_name, **kwargs):
        """Provide snapshot behavior for this test."""
        captured.update(kwargs)
        return str(tmp_path / REVISION)

    def load(path, **kwargs):
        """Provide load behavior for this test."""
        assert path == str(tmp_path / REVISION)
        assert kwargs["device"] == "cpu"
        return Agent()

    monkeypatch.setattr(huggingface_hub, "snapshot_download", snapshot)
    monkeypatch.setattr(laya, "load", load)
    model = LayaClassifier()
    model.fit(pd.DataFrame(), pd.DataFrame())
    result = model.predict(
        pd.DataFrame(
            [{"comment_id": "one", "comment_text": "Keep the first hour free."}]
        )
    )
    assert captured["revision"] == REVISION
    assert "model.safetensors" in captured["allow_patterns"]
    assert captured["cache_dir"] == ".cache/huggingface"
    assert result.error.isna().all()
    assert result.score.iloc[0] == 0.9
    assert model.metadata["resolved_revision"] == REVISION


def test_prediction_inputs_are_independent_of_column_order():
    """Reordering valid input columns must preserve the requested IDs and decisions."""
    frame = pd.DataFrame(
        {"comment_id": ["resident-1"], "comment_text": ["Improve crossings."]}
    )
    expected = AlwaysPositive().predict(frame)
    reordered = AlwaysPositive().predict(
        frame.filter(items=["comment_text", "comment_id"])
    )
    assert reordered.comment_id.tolist() == expected.comment_id.tolist()
    assert reordered.productive.tolist() == expected.productive.tolist()
    assert reordered.error.isna().all()
