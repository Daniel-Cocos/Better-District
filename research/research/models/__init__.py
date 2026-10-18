"""Lazy model imports let baselines run without initializing model runtimes."""

from importlib import import_module
from typing import cast

from research.config import ModelConfig
from research.contracts import Classifier

REGISTRY = {
    "always_positive": ("baselines", "AlwaysPositive"),
    "heuristic": ("baselines", "Heuristic"),
    "lightgbm": ("lightgbm", "LightGBMClassifier"),
    "deberta": ("deberta", "DebertaClassifier"),
    "zero_shot": ("llm", "ZeroShotClassifier"),
    "dspy": ("dspy", "DSPyClassifier"),
    "laya": ("laya", "LayaClassifier"),
}


def create_model(config: ModelConfig, seed: int) -> Classifier:
    """Construct the configured adapter without importing other model runtimes."""
    module, name = REGISTRY[config.kind]
    return cast(
        Classifier,
        getattr(import_module(f"research.models.{module}"), name)(
            seed=seed, **config.params
        ),
    )
