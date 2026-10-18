"""Simple reference classifiers and shared text features."""

from .base import BaseClassifier

REASONING = (
    "because",
    "therefore",
    "due to",
    "would mean",
    "so that",
    "if ",
    "could",
    "suggest",
    "should",
)
PLACES = (
    "portswood",
    "southampton",
    "bitterne",
    "shirley",
    "st denys",
    "highfield",
    "woolston",
    "the avenue",
)
RANTS = ("disgrace", "idiot", "stupid", "ridiculous", "waste of money")


def features(text):
    """Count length, reasoning, place and abuse features for a comment."""
    lower = text.casefold()
    return [
        len(text.split()),
        sum(lower.count(w) for w in REASONING),
        sum(lower.count(w) for w in PLACES),
        sum(lower.count(w) for w in RANTS),
    ]


class AlwaysPositive(BaseClassifier):
    """Predict the majority-positive baseline for every comment."""

    def predict_one(self, text):
        """Classify a single comment without accessing its reference label."""
        return {"productive": True, "score": 1.0}


class Heuristic(BaseClassifier):
    """Classify comments using length, reasoning, place and abuse counts."""

    def predict_one(self, text):
        """Classify a single comment without accessing its reference label."""
        words, reasons, places, rants = features(text)
        decision = words >= 8 and (reasons > 0 or places > 0) and rants <= reasons
        return {"productive": bool(decision), "score": None}
