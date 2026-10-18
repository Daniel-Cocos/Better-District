"""Single source registry shared by downloads, extraction and validation."""

from dataclasses import dataclass
import json
from pathlib import Path

DEFAULT_DATA_DIR = (
    Path(__file__).resolve().parent.parent / "southampton_consultation_data"
)


@dataclass(frozen=True)
class Source:
    """Identify a source PDF and the consultation it belongs to."""

    filename: str
    dataset_id: str
    policy_domain: str
    url: str


SOURCES = {
    s.dataset_id: s
    for s in (
        Source(**item)
        for item in json.loads(
            Path(__file__).with_name("sources.json").read_text(encoding="utf-8")
        )
    )
}
