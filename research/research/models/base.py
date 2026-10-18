"""Common prediction validation, timing, failure capture, and artifact storage."""

import json
from pathlib import Path
from time import perf_counter
from typing import Any

import pandas as pd

from research.contracts import INPUT_SCHEMA, PREDICTION_SCHEMA


class BaseClassifier:
    """Provide the dataframe interface around an adapter's single-text prediction."""

    requires_training = False

    def __init__(self, *, seed: int = 42) -> None:
        self.seed = seed
        self.raw: list[dict[str, Any]] = []
        self.metadata: dict[str, Any] = {}
        self.last_raw: Any = None

    def fit(self, train: pd.DataFrame, validation: pd.DataFrame) -> None:
        """Initialize an adapter; stateless baselines require no training."""

    def predict_one(self, text: str) -> dict[str, Any]:
        """Return a decision and optional score, usage, and raw provider output."""
        raise NotImplementedError

    @staticmethod
    def _validate_decision(result: dict[str, Any]) -> None:
        if not isinstance(result["productive"], bool):
            raise ValueError("Model must return a boolean decision")
        score = result["score"]
        if score is not None and not 0 <= float(score) <= 1:
            raise ValueError("Model returned a score outside [0, 1]")

    def _predict_record(self, comment_id: str, text: str) -> dict[str, Any]:
        started = perf_counter()
        result: dict[str, Any] = {
            "comment_id": comment_id,
            "productive": None,
            "score": None,
            "input_tokens": None,
            "output_tokens": None,
            "error": None,
        }
        self.last_raw = None
        raw = None
        try:
            value = self.predict_one(text)
            raw = value.pop("raw", None)
            result.update(value)
            self._validate_decision(result)
        # Provider failures must become explicit records rather than aborting the batch.
        except Exception as exc:  # pylint: disable=broad-exception-caught
            result.update(
                productive=None, score=None, error=f"{type(exc).__name__}: {exc}"
            )
        result["latency_ms"] = (perf_counter() - started) * 1000
        self.raw.append(
            {
                "comment_id": comment_id,
                "response": self.last_raw if raw is None else raw,
                "error": result["error"],
            }
        )
        return result

    def predict(self, comments: pd.DataFrame) -> pd.DataFrame:
        """Predict every requested ID, preserving failures and timing each request."""
        INPUT_SCHEMA.validate(comments)
        records = [
            self._predict_record(str(comment_id), str(text))
            for comment_id, text in comments.filter(
                items=["comment_id", "comment_text"]
            ).itertuples(index=False, name=None)
        ]
        return PREDICTION_SCHEMA.validate(
            pd.DataFrame(records, columns=list(PREDICTION_SCHEMA.columns)), lazy=True
        )

    def save(self, directory: Path) -> None:
        """Save model metadata and raw responses in the run's model directory."""
        directory.mkdir(parents=True, exist_ok=True)
        (directory / "metadata.json").write_text(
            json.dumps(self.metadata, indent=2, default=str) + "\n", encoding="utf-8"
        )
        with (directory / "raw_responses.jsonl").open("w", encoding="utf-8") as handle:
            for item in self.raw:
                handle.write(json.dumps(item, default=str) + "\n")
