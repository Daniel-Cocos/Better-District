"""Southampton consultation corpus and ground-truth loading API."""

from .data import extract_ground_truth, load_corpus, load_dataset, load_ground_truth
from .extract import extract_corpus
from .schemas import CORPUS_SCHEMA, GROUND_TRUTH_SCHEMA
from .sources import SOURCES

__all__ = [
    "load_corpus",
    "load_dataset",
    "load_ground_truth",
    "extract_corpus",
    "extract_ground_truth",
    "CORPUS_SCHEMA",
    "GROUND_TRUTH_SCHEMA",
    "SOURCES",
]
