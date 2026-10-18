"""PDF extraction with page provenance and separate response fields.

Generic text blocks are candidates for review, not verified respondent units.
Only the numbered Portswood log has a verified paired-table layout.
"""

import hashlib
import re
from pathlib import Path

import pandas as pd
import pdfplumber
import pymupdf

from .schemas import CORPUS_SCHEMA, empty_frame
from .sources import SOURCES, DEFAULT_DATA_DIR, Source


def clean_text(text: str | None) -> str:
    """Normalize PDF whitespace and remove extraction boilerplate."""
    text = text or ""
    text = re.sub(
        r"CAUTION:[^\n]*|Do not click links or open attachments[^\n]*",
        "",
        text,
        flags=re.I,
    )
    text = re.sub(r"\bPage\s+\d+\s+of\s+\d+\b", "", text, flags=re.I)
    text = re.sub(r"\[?\bREDACTED\b\]?", "[REDACTED]", text, flags=re.I)
    return re.sub(r"\s+", " ", text).strip()


def sha256(path: Path) -> str:
    """Hash a file incrementally without loading it into memory."""
    with path.open("rb") as handle:
        return hashlib.file_digest(handle, "sha256").hexdigest()


def validate_pdf(path: Path) -> None:
    """Reject non-PDF, empty and encrypted source files."""
    with path.open("rb") as handle:
        if not handle.read(1024).lstrip().startswith(b"%PDF-"):
            raise ValueError(f"{path}: response is not a PDF")
    with pymupdf.open(path) as doc:
        if not doc.page_count or doc.needs_pass:
            raise ValueError(f"{path}: empty or encrypted PDF")


# A corpus row explicitly names its source position, content and optional pairing.
# Keep these fields visible at extraction call sites.
# pylint: disable-next=too-many-arguments,too-many-positional-arguments
def _record(
    source: Source,
    digest: str,
    page: int,
    ref: str,
    text: str,
    response: str | None = None,
    paired: bool = False,
) -> dict:
    return {
        "comment_id": f"{source.dataset_id}_{ref}",
        "dataset_id": source.dataset_id,
        "policy_domain": source.policy_domain,
        "source_file": source.filename,
        "source_url": source.url,
        "source_sha256": digest,
        "page_number": page,
        "page_end": page,
        "source_ref": ref,
        "extraction_type": "paired_table" if paired else "text_block",
        "record_kind": "comment" if paired else "candidate",
        "comment_text": text,
        "officer_response": response,
        "char_length": len(text),
        "word_count": len(text.split()),
    }


def _portswood(path: Path, source: Source, digest: str) -> list[dict]:
    records = []
    seen = set()
    with pdfplumber.open(path) as doc:
        for page_number, page in enumerate(doc.pages, 1):
            for table in page.extract_tables():
                for row in table:
                    # Page 1's merged cells occupy twelve physical columns; later
                    # pages have four or six. Preserve blank cell positions.
                    cells = [clean_text(c) for c in row]
                    if len(cells) == 12:
                        cells = [cells[i] for i in (0, 3, 6, 9)]
                    elif len(cells) == 6:
                        cells = [cells[i] for i in (0, 1, 3, 4)]
                    if len(cells) != 4:
                        raise ValueError(
                            (
                                "Unexpected Portswood table layout on page "
                                f"{page_number}: {len(cells)} cells"
                            )
                        )
                    _, reference, comment, response = cells
                    if reference.isdigit():
                        if reference in seen or not comment or not response:
                            raise ValueError(
                                (
                                    "Invalid/repeated Portswood reference "
                                    f"{reference} on page {page_number}"
                                )
                            )
                        seen.add(reference)
                        records.append(
                            _record(
                                source,
                                digest,
                                page_number,
                                f"ref{reference}",
                                comment,
                                response,
                                True,
                            )
                        )
                    elif not reference and not comment and response:
                        if not records:
                            raise ValueError("Orphan Portswood response continuation")
                        records[-1]["officer_response"] += " " + response
                        records[-1]["page_end"] = page_number
                    elif reference and reference != "Ref.":
                        raise ValueError(
                            f"Unrecognised Portswood reference: {reference!r}"
                        )
    if not records:
        raise ValueError("No numbered Portswood comment/response pairs found")
    return records


def extract_corpus(
    data_dir: str | Path = DEFAULT_DATA_DIR, dataset_ids: list[str] | None = None
) -> pd.DataFrame:
    """Extract selected PDFs; missing or malformed sources fail explicitly.

    IDs identify source positions, not deduplicated text. Repeated wording by
    different respondents is retained. Text blocks may split comments across pages.
    """
    records = []
    for dataset_id in SOURCES if dataset_ids is None else dataset_ids:
        source = SOURCES[dataset_id]
        path = Path(data_dir) / "raw_pdfs" / source.filename
        validate_pdf(path)
        digest = sha256(path)
        if dataset_id == "psg29_portswood_log":
            records.extend(_portswood(path, source, digest))
            continue
        with pymupdf.open(path) as doc:
            for page_number, page in enumerate(doc.pages(), 1):
                for index, block in enumerate(page.get_text("blocks", sort=True)):
                    if block[6] != 0:
                        continue
                    text = clean_text(block[4])
                    if len(text) >= 45:
                        records.append(
                            _record(
                                source,
                                digest,
                                page_number,
                                f"p{page_number}_b{index}",
                                text,
                            )
                        )
    if not records:
        return empty_frame(CORPUS_SCHEMA)
    return CORPUS_SCHEMA.validate(pd.DataFrame(records), lazy=True)
