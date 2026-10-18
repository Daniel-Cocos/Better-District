"""Validated loading and auditable labels for evaluation."""

from pathlib import Path

import pandas as pd

from .schemas import CORPUS_SCHEMA, GROUND_TRUTH_SCHEMA, empty_frame
from .sources import DEFAULT_DATA_DIR, SOURCES


def _read(path: Path) -> pd.DataFrame:
    if path.suffix == ".parquet":
        return pd.read_parquet(path)
    if path.suffix == ".csv":
        # Preserve literal comments such as 'NA' and source references with zeros.
        return pd.read_csv(
            path, keep_default_na=False, na_values=[""], dtype={"source_ref": "string"}
        )
    raise ValueError("Expected a .csv or .parquet file")


def load_corpus(
    data_dir: str | Path = DEFAULT_DATA_DIR,
    *,
    path: str | Path | None = None,
    dataset_ids: list[str] | None = None,
) -> pd.DataFrame:
    """Load the new corpus format and validate before optionally filtering.

    Legacy aggregates must be rebuilt with `make data-offline`.
    """
    if dataset_ids is not None and set(dataset_ids) - SOURCES.keys():
        raise ValueError(f"Unknown datasets: {set(dataset_ids) - SOURCES.keys()}")
    frame = CORPUS_SCHEMA.validate(
        _read(
            Path(path)
            if path
            else Path(data_dir) / "southampton_consultations_aggregated.parquet"
        ),
        lazy=True,
    )
    if dataset_ids is not None:
        frame = pd.DataFrame(frame.loc[frame.dataset_id.isin(dataset_ids), :])
    return frame.reset_index(drop=True)


def extract_ground_truth(
    corpus: pd.DataFrame,
    *,
    annotations: str | Path | None = None,
    include_silver: bool = False,
) -> pd.DataFrame:
    """Return labels only; missing labels are unknown, never negative.

    Silver Portswood positives implement the README's dataset-level assumption.
    A council response does not prove a comment is constructive. Reviewed labels
    override silver labels. Legal validity is a separate target from productivity.
    """
    CORPUS_SCHEMA.validate(corpus, lazy=True)
    labels = empty_frame(GROUND_TRUTH_SCHEMA)
    if include_silver:
        pairs = corpus[
            (corpus.dataset_id == "psg29_portswood_log")
            & (corpus.extraction_type == "paired_table")
        ]
        labels = pd.DataFrame(
            [
                {
                    "comment_id": comment_id,
                    "source_sha256": digest,
                    "productive": True,
                    "label_quality": "silver",
                    "label_scope": "constructive_feedback",
                    "label_basis": "README Portswood dataset-level positive assumption",
                    "evidence": response,
                    "reviewer": None,
                }
                for comment_id, digest, response in pairs.filter(
                    items=["comment_id", "source_sha256", "officer_response"]
                ).itertuples(index=False, name=None)
            ],
            columns=list(GROUND_TRUTH_SCHEMA.columns),
        )
        labels = GROUND_TRUTH_SCHEMA.validate(labels)
    if annotations is not None:
        reviewed = GROUND_TRUTH_SCHEMA.validate(_read(Path(annotations)), lazy=True)
        if not reviewed.label_quality.isin(["reviewed", "ai_reference"]).all():
            raise ValueError(
                (
                    "Annotation files must contain reviewed or explicitly "
                    "identified AI reference labels"
                )
            )
        known = corpus.set_index("comment_id").source_sha256
        unknown = set(reviewed.comment_id) - set(known.index)
        if unknown:
            raise ValueError(
                f"Annotations reference unknown comment IDs: {sorted(unknown)}"
            )
        if not reviewed.source_sha256.eq(reviewed.comment_id.map(known)).all():
            raise ValueError(
                "Annotations refer to different PDF hashes; re-review changed sources"
            )
        labels = pd.concat(
            [labels[~labels.comment_id.isin(reviewed.comment_id)], reviewed],
            ignore_index=True,
        )
    return GROUND_TRUTH_SCHEMA.validate(
        pd.DataFrame(labels).reset_index(drop=True), lazy=True
    )


def load_ground_truth(
    data_dir: str | Path = DEFAULT_DATA_DIR,
    *,
    annotations: str | Path | None = None,
    include_silver: bool = False,
) -> pd.DataFrame:
    """Load validated labels for the selected corpus."""
    return extract_ground_truth(
        load_corpus(data_dir), annotations=annotations, include_silver=include_silver
    )


def load_dataset(
    data_dir: str | Path = DEFAULT_DATA_DIR,
    *,
    annotations: str | Path | None = None,
    include_silver: bool = False,
) -> pd.DataFrame:
    """Join corpus and labels one-to-one; `productive` uses nullable boolean dtype.

    Use only `comment_text` as model input. Officer responses and label evidence
    leak the evaluation target. Filter label_scope before evaluating a target.
    """
    corpus = load_corpus(data_dir)
    labels = extract_ground_truth(
        corpus, annotations=annotations, include_silver=include_silver
    )
    return corpus.merge(
        labels.drop(columns="source_sha256"),
        on="comment_id",
        how="left",
        validate="one_to_one",
    )
