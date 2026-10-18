"""Models receive only IDs/text for inference and IDs/text/labels for training."""

from pathlib import Path
from typing import Protocol

import pandas as pd
import pandera.pandas as pa

INPUT_SCHEMA = pa.DataFrameSchema(
    {
        "comment_id": pa.Column(str, unique=True),
        "comment_text": pa.Column(str, pa.Check.str_length(min_value=1)),
    },
    strict=True,
)
PREDICTION_SCHEMA = pa.DataFrameSchema(
    {
        "comment_id": pa.Column(str, unique=True),
        "productive": pa.Column(pd.BooleanDtype(), nullable=True),
        "score": pa.Column(float, pa.Check.in_range(0, 1), nullable=True),
        "latency_ms": pa.Column(float, pa.Check.ge(0)),
        "input_tokens": pa.Column(pd.Int64Dtype(), pa.Check.ge(0), nullable=True),
        "output_tokens": pa.Column(pd.Int64Dtype(), pa.Check.ge(0), nullable=True),
        "error": pa.Column(str, nullable=True),
    },
    checks=[
        pa.Check(
            lambda d: d.productive.notna() == d.error.isna(),
            name="failures_are_explicit",
        ),
    ],
    strict=True,
    coerce=True,
)


class Classifier(Protocol):
    """Training, inference and artifact interface shared by model adapters."""

    requires_training: bool

    def fit(self, train: pd.DataFrame, validation: pd.DataFrame) -> None:
        """Fit the adapter using training labels and optional validation data."""
        raise NotImplementedError

    def predict(self, comments: pd.DataFrame) -> pd.DataFrame:
        """Return schema-validated predictions for the supplied comment inputs."""
        raise NotImplementedError

    def save(self, directory: Path) -> None:
        """Write model state and metadata to the run artifact directory."""
        raise NotImplementedError


def training_input(frame: pd.DataFrame) -> pd.DataFrame:
    """Select the only three fields permitted during model training."""
    return frame.filter(items=["comment_id", "comment_text", "productive"]).copy()


def prediction_input(frame: pd.DataFrame) -> pd.DataFrame:
    """Select and validate the ID and text fields permitted for inference."""
    return INPUT_SCHEMA.validate(
        frame.filter(items=["comment_id", "comment_text"]).copy()
    )
