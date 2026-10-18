"""LightGBM adapter using transparent text feature counts."""

from pathlib import Path

import joblib
import numpy as np
import pandas as pd

from .base import BaseClassifier
from .baselines import features


class LightGBMClassifier(BaseClassifier):
    """Fit a small boosted-tree classifier on transparent text features."""

    requires_training = True

    def __init__(self, *, seed=42, n_estimators=100, num_leaves=15, learning_rate=0.05):
        super().__init__(seed=seed)
        from lightgbm import LGBMClassifier

        self.model = LGBMClassifier(
            n_estimators=n_estimators,
            num_leaves=num_leaves,
            learning_rate=learning_rate,
            random_state=seed,
            n_jobs=1,
            verbosity=-1,
        )
        self.metadata = {
            "features": [
                "word_count",
                "reasoning_terms",
                "southampton_places",
                "rant_terms",
            ]
        }

    def fit(self, train, validation):
        """Fit the adapter using training labels and optional validation data."""
        del validation
        matrix = pd.DataFrame(
            [features(t) for t in train.comment_text], columns=self.metadata["features"]
        )
        self.model.fit(matrix, train.productive.astype(int))

    def predict_one(self, text):
        """Classify a single comment without accessing its reference label."""
        score = float(
            np.asarray(
                self.model.predict_proba(
                    pd.DataFrame([features(text)], columns=self.metadata["features"])
                )
            )[0, 1]
        )
        return {"productive": score >= 0.5, "score": score}

    def save(self, directory: Path):
        """Write model state and metadata to the run artifact directory."""
        super().save(directory)
        if hasattr(self.model, "classes_"):
            joblib.dump(self.model, directory / "model.joblib")
