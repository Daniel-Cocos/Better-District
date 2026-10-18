"""Regression checks for source extraction and validated data loading."""

from pathlib import Path

import pandas as pd
import pandera.errors
import pdfplumber
import pymupdf
import pytest

from consultations import (
    CORPUS_SCHEMA,
    extract_corpus,
    extract_ground_truth,
    load_corpus,
    load_dataset,
)
from consultations.download import download_source
from consultations.extract import _portswood, _record, sha256
from consultations.sources import SOURCES


@pytest.fixture(name="corpus")
def sample_corpus():
    """Provide sample corpus behavior for this test."""
    source = SOURCES["psg29_portswood_log"]
    return CORPUS_SCHEMA.validate(
        pd.DataFrame(
            [
                _record(
                    source,
                    "a" * 64,
                    1,
                    "ref1",
                    "Make the crossing safer.",
                    "We will review it.",
                    True,
                ),
                _record(
                    source,
                    "a" * 64,
                    1,
                    "ref2",
                    "Keep these parking spaces.",
                    "Noted.",
                    True,
                ),
                _record(
                    SOURCES["s50527_licensing"],
                    "b" * 64,
                    2,
                    "p2_b0",
                    "Noise keeps us awake at night.",
                ),
            ]
        )
    )


def test_labels_are_opt_in_and_unknowns_stay_unknown(corpus, tmp_path):
    """Labels are opt in and unknowns stay unknown."""
    assert extract_ground_truth(corpus).empty
    labels = extract_ground_truth(corpus, include_silver=True)
    assert labels.comment_id.tolist() == corpus.comment_id[:2].tolist()
    assert labels.productive.all()
    corpus.to_parquet(
        tmp_path / "southampton_consultations_aggregated.parquet", index=False
    )
    joined = load_dataset(tmp_path, include_silver=True)
    assert str(joined.productive.dtype) == "boolean"
    assert pd.isna(joined.iloc[2].productive)
    assert load_corpus(tmp_path, dataset_ids=[]).empty
    with pytest.raises(ValueError, match="Unknown datasets"):
        load_corpus(tmp_path, dataset_ids=["typo"])


def test_reviewed_annotations_override_silver_and_require_matching_source(
    corpus, tmp_path
):
    """Reviewed annotations override silver and require matching source."""
    labels = extract_ground_truth(corpus, include_silver=True).iloc[:1].copy()
    labels["productive"] = False
    labels["label_quality"] = "reviewed"
    labels["label_basis"] = "Manual assessment"
    labels["evidence"] = "Reviewed against the agreed rubric"
    labels["reviewer"] = "researcher"
    path = tmp_path / "annotations.csv"
    labels.to_csv(path, index=False)
    result = extract_ground_truth(corpus, include_silver=True, annotations=path)
    assert not result.set_index("comment_id").loc[
        labels.iloc[0].comment_id, "productive"
    ]
    labels["source_sha256"] = "c" * 64
    labels.to_csv(path, index=False)
    with pytest.raises(ValueError, match="hashes"):
        extract_ground_truth(corpus, annotations=path)
    labels["comment_id"] = "unknown"
    labels.to_csv(path, index=False)
    with pytest.raises(ValueError, match="unknown comment IDs"):
        extract_ground_truth(corpus, annotations=path)


def test_schema_rejects_duplicate_ids_and_inconsistent_counts(corpus):
    """Schema rejects duplicate ids and inconsistent counts."""
    with pytest.raises(pandera.errors.SchemaError):
        CORPUS_SCHEMA.validate(pd.concat([corpus, corpus]))
    corpus.loc[0, "word_count"] = 999
    with pytest.raises(pandera.errors.SchemaError):
        CORPUS_SCHEMA.validate(corpus)


def test_csv_and_parquet_roundtrip_preserve_text(corpus, tmp_path):
    """Csv and parquet roundtrip preserve text."""
    corpus.loc[0, ["comment_text", "word_count", "char_length"]] = ["NA", 1, 2]
    for suffix in ["csv", "parquet"]:
        path = tmp_path / f"corpus.{suffix}"
        if suffix == "csv":
            corpus.to_csv(path, index=False)
        else:
            corpus.to_parquet(path, index=False)
        loaded = load_corpus(path=path)
        pd.testing.assert_frame_equal(loaded, corpus)


def test_extraction_retains_distinct_occurrences(tmp_path):
    """Extraction retains distinct occurrences."""
    source = SOURCES["s69290_budget"]
    raw = tmp_path / "raw_pdfs"
    raw.mkdir()
    with pymupdf.open() as doc:
        for _ in range(2):
            page = doc.new_page()
            page.insert_text(
                (50, 50),
                "This is a resident comment about council tax and empty homes.",
            )
        doc.save(raw / source.filename)
    frame = extract_corpus(tmp_path, [source.dataset_id])
    assert len(frame) == 2
    assert frame.comment_id.nunique() == 2
    assert frame.source_sha256.nunique() == 1
    assert frame.record_kind.eq("candidate").all()
    with pytest.raises(FileNotFoundError):
        extract_corpus(tmp_path, ["s77446_carparks"])


def test_portswood_continuations_and_column_positions(monkeypatch):
    """Portswood continuations and column positions."""

    # Only the table extraction method is relevant to this test.
    class Page:  # pylint: disable=too-few-public-methods
        """Provide page behavior for this test."""

        def __init__(self, rows):
            self.rows = rows

        def extract_tables(self):
            """Provide extract tables behavior for this test."""
            return [self.rows]

    class Document:
        """Provide document behavior for this test."""

        pages = [
            Page(
                [
                    [
                        "",
                        "Document",
                        "",
                        "",
                        "Ref.",
                        "",
                        "",
                        "Comments from members",
                        "",
                        "",
                        "SCC response",
                        "",
                    ],
                    [
                        "Section",
                        None,
                        None,
                        "1",
                        None,
                        None,
                        "Resident comment",
                        None,
                        None,
                        "Officer reply",
                        None,
                        None,
                    ],
                ]
            ),
            Page(
                [
                    ["", "", None, "", "Continued reply", None],
                    [None, "2", None, "Second comment", "Second reply", None],
                ]
            ),
        ]

        def __enter__(self):
            return self

        def __exit__(self, *args):
            pass

    monkeypatch.setattr(pdfplumber, "open", lambda p: Document())
    rows = _portswood(Path("unused"), SOURCES["psg29_portswood_log"], "a" * 64)
    assert len(rows) == 2
    assert rows[0]["comment_text"] == "Resident comment"
    assert rows[0]["officer_response"] == "Officer reply Continued reply"
    assert rows[0]["page_end"] == 2
    assert rows[1]["source_ref"] == "ref2"


def test_download_failure_preserves_cached_pdf(tmp_path, monkeypatch):
    """Download failure preserves cached pdf."""
    source = SOURCES["s69290_budget"]
    target = tmp_path / source.filename
    with pymupdf.open() as doc:
        doc.new_page()
        doc.save(target)
    digest = sha256(target)
    # Valid cache must not invoke the network.
    from consultations import download

    def fail(*args, **kwargs):
        """Provide fail behavior for this test."""
        raise OSError("network down")

    monkeypatch.setattr(download, "urlopen", fail)
    monkeypatch.setattr(download.time, "sleep", lambda _: None)
    assert download_source(source, tmp_path) == target
    with pytest.raises(OSError, match="network down"):
        download_source(source, tmp_path, force=True)
    assert sha256(target) == digest
    assert list(tmp_path.iterdir()) == [target]


def test_download_rejects_html_and_cleans_partial_files(tmp_path, monkeypatch):
    """Download rejects html and cleans partial files."""
    import io
    from consultations import download

    monkeypatch.setattr(
        download, "urlopen", lambda *a, **k: io.BytesIO(b"<html>not a pdf</html>")
    )
    monkeypatch.setattr(download.time, "sleep", lambda _: None)
    with pytest.raises(ValueError, match="not a PDF"):
        download_source(SOURCES["s69290_budget"], tmp_path)
    assert not list(tmp_path.iterdir())
