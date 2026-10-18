"""Classification, coverage, latency, and decision-cost metrics."""

from dataclasses import dataclass
from typing import Any

import numpy as np
import pandas as pd
from sklearn.metrics import average_precision_score, roc_auc_score


def _divide(numerator: float, denominator: float) -> float | None:
    return numerator / denominator if denominator else None


@dataclass(frozen=True)
class ConfusionCounts:
    """Binary confusion counts for a defined prediction population."""

    tp: int
    tn: int
    fp: int
    fn: int

    @classmethod
    def from_predictions(
        cls, truth: pd.Series, predicted: pd.Series
    ) -> "ConfusionCounts":
        """Count the four combinations without converting unknown labels to false."""
        true, pred = truth.astype(bool), predicted.astype(bool)
        return cls(
            int((true & pred).sum()),
            int((~true & ~pred).sum()),
            int((~true & pred).sum()),
            int((true & ~pred).sum()),
        )

    @property
    def both_classes(self) -> bool:
        """Whether the counted population contains positive and negative references."""
        return self.tp + self.fn > 0 and self.tn + self.fp > 0

    def metrics(self) -> dict[str, Any]:
        """Compute defined quality ratios from these counts."""
        positive, negative = self.tp + self.fn, self.tn + self.fp
        return {
            "tp": self.tp,
            "tn": self.tn,
            "fp": self.fp,
            "fn": self.fn,
            "positive_support": positive,
            "negative_support": negative,
            "both_classes": self.both_classes,
            "accuracy": _divide(self.tp + self.tn, positive + negative),
            "precision": _divide(self.tp, self.tp + self.fp),
            "recall": _divide(self.tp, positive),
            "specificity": _divide(self.tn, negative),
            "f1": _divide(2 * self.tp, 2 * self.tp + self.fp + self.fn),
            "f2": _divide(5 * self.tp, 5 * self.tp + 4 * self.fn + self.fp),
            "balanced_accuracy": (
                ((self.tp / positive + self.tn / negative) / 2)
                if self.both_classes
                else None
            ),
        }


def _timing_and_usage(predictions: pd.DataFrame) -> dict[str, Any]:
    latency = predictions.latency_ms
    return {
        "latency_ms_mean": float(latency.mean()) if len(latency) else None,
        "latency_ms_p50": float(latency.quantile(0.5)) if len(latency) else None,
        "latency_ms_p95": float(latency.quantile(0.95)) if len(latency) else None,
        "input_tokens": (
            int(predictions.input_tokens.sum())
            if predictions.input_tokens.notna().any()
            else None
        ),
        "output_tokens": (
            int(predictions.output_tokens.sum())
            if predictions.output_tokens.notna().any()
            else None
        ),
    }


def _ranking_metrics(
    scored: pd.DataFrame, both_classes: bool
) -> dict[str, float | None]:
    if both_classes and scored.score.notna().all():
        truth = scored.productive_true.astype(int)
        return {
            "roc_auc": float(roc_auc_score(truth, scored.score)),
            "average_precision": float(average_precision_score(truth, scored.score)),
        }
    return {"roc_auc": None, "average_precision": None}


def _cost_sensitivity(
    counts: ConfusionCounts, size: int, ratios: tuple | list
) -> pd.DataFrame:
    rows = (
        [
            {
                "fn_cost_ratio": float(ratio),
                "false_negative_cost": counts.fn * ratio,
                "false_positive_cost": counts.fp,
                "total_cost": counts.fn * ratio + counts.fp,
                "cost_per_1000_scored": (counts.fn * ratio + counts.fp) * 1000 / size,
            }
            for ratio in ratios
        ]
        if size
        else []
    )
    return pd.DataFrame(
        rows,
        columns=[
            "fn_cost_ratio",
            "false_negative_cost",
            "false_positive_cost",
            "total_cost",
            "cost_per_1000_scored",
        ],
    )


def evaluate(
    predictions: pd.DataFrame, ratios=(1, 2, 5, 10), cost_per_1000=None
) -> tuple[dict[str, Any], pd.DataFrame]:
    """Score successful labelled predictions while reporting unknowns and failures."""
    labelled = predictions.productive_true.notna()
    success = predictions.error.isna() & predictions.productive.notna()
    scored = pd.DataFrame(predictions.loc[labelled & success, :])
    counts = ConfusionCounts.from_predictions(scored.productive_true, scored.productive)
    metrics = counts.metrics()
    metrics.update(
        n_test=len(predictions),
        n_labelled=int(labelled.sum()),
        n_scored=len(scored),
        n_failed=int((~success).sum()),
        n_failed_labelled=int((labelled & ~success).sum()),
        n_unknown=int((~labelled).sum()),
        coverage=_divide(int(success.sum()), len(predictions)),
        labelled_coverage=_divide(len(scored), int(labelled.sum())),
        recall_with_failed_positives_missed=_divide(
            counts.tp, int(predictions.loc[labelled, "productive_true"].sum())
        ),
        inference_cost_per_1000_usd=cost_per_1000,
        estimated_test_cost_usd=(
            len(predictions) / 1000 * cost_per_1000
            if cost_per_1000 is not None
            else None
        ),
        metric_population=(
            "Successful labelled predictions; label source "
            "and coverage are reported separately"
        ),
    )
    metrics.update(
        _timing_and_usage(predictions), **_ranking_metrics(scored, counts.both_classes)
    )
    return metrics, _cost_sensitivity(counts, len(scored), ratios)


def threshold_sweep(predictions: pd.DataFrame) -> pd.DataFrame:
    """Describe numeric-score operating points without selecting on test labels."""
    mask = (
        predictions.productive_true.notna()
        & predictions.score.notna()
        & predictions.error.isna()
    )
    scored = pd.DataFrame(predictions.loc[mask, :])
    rows = []
    thresholds = (
        sorted(set([0.0, 0.5, 1.0] + scored.score.tolist())) if len(scored) else []
    )
    for threshold in thresholds:
        counts = ConfusionCounts.from_predictions(
            scored.productive_true, scored.score.ge(threshold)
        )
        values = counts.metrics()
        rows.append(
            {
                "threshold": threshold,
                "tp": counts.tp,
                "fp": counts.fp,
                "fn": counts.fn,
                "tn": counts.tn,
                "precision": (
                    values["precision"] if values["precision"] is not None else np.nan
                ),
                "recall": values["recall"] if values["recall"] is not None else np.nan,
            }
        )
    return pd.DataFrame(
        rows, columns=["threshold", "tp", "fp", "fn", "tn", "precision", "recall"]
    )


def select_threshold(predictions: pd.DataFrame, fn_cost_ratio: float = 5.0) -> float:
    """Minimize configured decision cost on successful, fully scored validation data."""
    if predictions.productive_true.dropna().nunique() != 2:
        raise ValueError("Threshold selection needs both classes in validation labels")
    labelled = predictions[predictions.productive_true.notna()]
    if labelled.score.isna().any() or labelled.error.notna().any():
        raise ValueError(
            (
                "Threshold selection requires a score and successful "
                "prediction for every validation label"
            )
        )
    sweep = threshold_sweep(predictions)
    sweep["cost"] = sweep.fn * fn_cost_ratio + sweep.fp
    return float(sweep.sort_values(["cost", "threshold"]).iloc[0].threshold)
