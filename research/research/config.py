"""Strict experiment configuration. Paths are relative to the working directory."""

import os
from pathlib import Path
import re
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator
import yaml


class StrictModel(BaseModel):
    """Reject unknown configuration fields to catch spelling mistakes."""

    model_config = ConfigDict(extra="forbid")


class DataConfig(StrictModel):
    """Select the corpus, reference labels and split strategy."""

    data_dir: Path = Path("southampton_consultation_data")
    annotations: Path | None = None
    include_silver_train: bool = False
    include_candidates: bool = False
    scope: Literal["constructive_feedback", "licensing_legal_validity"] = (
        "constructive_feedback"
    )
    validation_groups: list[str] = Field(default_factory=lambda: ["licensing"])
    test_groups: list[str] = Field(default_factory=lambda: ["budget"])
    splits_file: Path | None = None
    reference_quality: Literal["reviewed", "ai_reference"] = "reviewed"
    split_strategy: Literal["consultation", "stratified"] = "consultation"

    @model_validator(mode="after")
    def disjoint(self):
        """Reject overlapping validation and test consultation groups."""
        if set(self.validation_groups) & set(self.test_groups):
            raise ValueError("Validation and test groups overlap")
        return self


class ModelConfig(StrictModel):
    """Identify a model adapter and its adapter-specific parameters."""

    kind: Literal[
        "always_positive",
        "heuristic",
        "lightgbm",
        "deberta",
        "zero_shot",
        "dspy",
        "laya",
    ]
    params: dict = Field(default_factory=dict)


class ExperimentConfig(StrictModel):
    """Define one reproducible benchmark run and its output settings."""

    name: str = Field(pattern=r"^[A-Za-z0-9_-]+$")
    seed: int = Field(default=42, ge=0)
    output_dir: Path = Path("runs")
    data: DataConfig = Field(default_factory=DataConfig)
    model: ModelConfig
    threshold: float = Field(default=0.5, ge=0, le=1)
    tune_threshold: bool = False
    threshold_fn_cost_ratio: float = Field(default=5.0, gt=0)
    fn_cost_ratios: list[float] = Field(default_factory=lambda: [1, 2, 5, 10])
    inference_cost_per_1000_usd: float | None = Field(default=None, ge=0)

    @model_validator(mode="after")
    def ratios(self):
        """Require positive false-negative cost ratios."""
        if not self.fn_cost_ratios or any(r <= 0 for r in self.fn_cost_ratios):
            raise ValueError("fn_cost_ratios must be positive")
        return self


def load_config(path: Path, model_name: str | None = None) -> ExperimentConfig:
    """Load YAML configuration, resolve environment values and validate it."""
    values = yaml.safe_load(path.read_text())
    if model_name is not None:
        values["model"].setdefault("params", {})["model_name"] = model_name

    def expand(value):
        """Resolve environment placeholders recursively in YAML values."""
        if isinstance(value, dict):
            return {k: expand(v) for k, v in value.items()}
        if isinstance(value, list):
            return [expand(v) for v in value]
        if isinstance(value, str):
            value = os.path.expandvars(value)
            if re.search(r"\$\{?\w+", value):
                raise ValueError(
                    (
                        f"Unresolved environment variable in {value!r}; set it "
                        "or pass --model-name"
                    )
                )
        return value

    return ExperimentConfig.model_validate(expand(values))
