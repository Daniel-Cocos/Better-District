"""Extract individual comment units for the benchmark.

Unlike the generic corpus, this excludes summary reports. Parking responses are
bounded by alternating shaded rows, not PDF text blocks. Boundary rows are
excluded because they can continue across pages; this trades coverage for safer
benchmark units rather than page-sized blocks.
"""

from pathlib import Path
import re

import pandas as pd
import pymupdf

from .extract import _portswood, _record, clean_text, sha256, validate_pdf
from .schemas import CORPUS_SCHEMA
from .sources import DEFAULT_DATA_DIR, SOURCES

LIGHT_BLUE = (0.867, 0.922, 0.969)


def parking_rows(page) -> list[tuple[float, float, str]]:
    """Return alternating shaded/unshaded bands that contain response text."""
    bands = []
    for drawing in page.get_drawings():
        fill = drawing.get("fill")
        rect = drawing["rect"]
        if (
            fill
            and len(fill) == 3
            and all(abs(a - b) < 0.015 for a, b in zip(fill, LIGHT_BLUE))
            and rect.width > 445
            and rect.height > 2
        ):
            bands.append((rect.y0, rect.y1))
    bands = sorted(set(bands))
    if not bands:
        raise ValueError(
            f"No shaded response rows detected on parking PDF page {page.number + 1}"
        )
    if any(bands[i][1] > bands[i + 1][0] + 0.2 for i in range(len(bands) - 1)):
        raise ValueError("Overlapping parking row backgrounds; inspect source layout")
    # Each text line belongs to a band or a white gap. Exclude the title/header.
    groups = {}
    for block in page.get_text("dict", sort=True)["blocks"]:
        if block["type"] != 0:
            continue
        for line in block["lines"]:
            text = "".join(span["text"] for span in line["spans"]).strip()
            if not text or text.startswith("Appendix 5"):
                continue
            bbox = line["bbox"]
            if bbox[0] < 70 or bbox[2] > 525 or bbox[1] < 70 or bbox[3] > 780:
                raise ValueError(
                    f"Unexpected parking text outside response area: {text[:50]}"
                )
            middle = (bbox[1] + bbox[3]) / 2
            key = 2 * len(bands)
            for i, (top, bottom) in enumerate(bands):
                if middle < top:
                    key = 2 * i
                    break
                if top <= middle <= bottom:
                    key = 2 * i + 1
                    break
            groups.setdefault(key, []).append((bbox, text))
    return [
        (
            min(r[0][1] for r in rows),
            max(r[0][3] for r in rows),
            clean_text(" ".join(r[1] for r in rows)),
        )
        for _, rows in sorted(groups.items())
    ]


def extract_comment_units(
    data_dir: str | Path = DEFAULT_DATA_DIR,
) -> tuple[pd.DataFrame, dict]:
    """Extract safe parking interior rows, all Portswood log entries and PNA quotes.

    Units are structurally extracted, not manually or automatically labelled.
    Source-row membership is not proof of a unique respondent or productivity.
    """
    raw = Path(data_dir) / "raw_pdfs"
    records, excluded = _parking_units(raw)
    records.extend(_portswood_units(raw))
    records.extend(_pna_units(raw))
    frame = CORPUS_SCHEMA.validate(pd.DataFrame(records), lazy=True)
    return frame, {
        "method": (
            "parking row shading (interior rows only), numbered "
            "Portswood log, PNA quoted comments"
        ),
        "parking_boundary_rows_excluded": excluded,
        "excluded_sources": [
            "s69290_budget",
            "s59108_portswood_p1",
            "media3131_portswood_p2",
            "s50527_licensing",
        ],
        "limitations": [
            "Parking page-boundary rows are excluded, creating selection bias.",
            (
                "Log entries may be summaries of group feedback rather than "
                "verbatim individual responses."
            ),
            "Licensing needs OCR/letter and email-thread segmentation before safe use.",
            (
                "Budget and Portswood consultation feedback reports contain "
                "aggregate themes, not a respondent corpus."
            ),
        ],
    }


def _parking_units(raw: Path) -> tuple[list[dict], list[dict]]:
    records, excluded = [], []
    source = SOURCES["s77446_carparks"]
    path = raw / source.filename
    validate_pdf(path)
    digest = sha256(path)
    with pymupdf.open(path) as doc:
        for number, page in enumerate(doc.pages(), 1):
            rows = parking_rows(page)
            for index, (_, _, text) in enumerate(rows):
                reference = f"p{number}_row{index+1}"
                if index in {0, len(rows) - 1}:
                    excluded.append(
                        {
                            "source_ref": reference,
                            "reason": "Conservative exclusion of page-boundary rows",
                        }
                    )
                    continue
                record = _record(source, digest, number, reference, text)
                record.update(extraction_type="shaded_row", record_kind="comment")
                records.append(record)
    return records, excluded


def _portswood_units(raw: Path) -> list[dict]:
    source = SOURCES["psg29_portswood_log"]
    path = raw / source.filename
    validate_pdf(path)
    return _portswood(path, source, sha256(path))


def _pna_units(raw: Path) -> list[dict]:
    records = []
    source = SOURCES["s57570_pna"]
    path = raw / source.filename
    validate_pdf(path)
    with pymupdf.open(path) as doc:
        text = str(doc[8].get_text())
    # The source page uses an actual bullet character before each quoted comment.
    quotes = re.findall(
        r'[▪]\s*[“"](.*?)[“”"](?=\s*'
        r"(?:Short consultation|Comments received|[▪]|\*No comments))",
        text,
        flags=re.S,
    )
    if len(quotes) != 8:
        raise ValueError(
            f"Expected eight PNA free-text quotes on PDF page 9; found {len(quotes)}"
        )
    for i, quote in enumerate(quotes, 1):
        record = _record(source, sha256(path), 9, f"p9_quote{i}", clean_text(quote))
        record.update(extraction_type="quoted_comment", record_kind="comment")
        records.append(record)
    return records
