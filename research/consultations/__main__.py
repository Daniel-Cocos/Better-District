"""Run with `python -m consultations --help` inside the Nix environment."""

import argparse
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import tempfile

from .data import extract_ground_truth
from .download import download_source
from .extract import extract_corpus
from .sources import DEFAULT_DATA_DIR, SOURCES


def atomic_write(path: Path, writer) -> None:
    """Replace an output only after its writer succeeds on a temporary file."""
    with tempfile.NamedTemporaryFile(
        dir=path.parent, suffix=path.suffix, delete=False
    ) as f:
        temporary = Path(f.name)
    try:
        writer(temporary)
        os.replace(temporary, path)
    finally:
        temporary.unlink(missing_ok=True)


def main() -> None:
    """Parse command-line arguments and execute the requested operation."""
    parser = argparse.ArgumentParser(
        description="Download and extract Southampton consultation PDFs"
    )
    parser.add_argument("--data-dir", type=Path, default=DEFAULT_DATA_DIR)
    parser.add_argument(
        "--dataset", action="append", choices=SOURCES, help="Repeat to select sources"
    )
    parser.add_argument(
        "--offline",
        action="store_true",
        help="Require cached PDFs; never access network",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Replace cached PDFs after validating new downloads",
    )
    args = parser.parse_args()
    if args.offline and args.force:
        parser.error("--offline and --force cannot be combined")
    datasets = list(dict.fromkeys(args.dataset or SOURCES))
    args.data_dir.mkdir(parents=True, exist_ok=True)
    for dataset_id in datasets:
        print(f"Preparing {dataset_id}", flush=True)
        if not args.offline:
            download_source(
                SOURCES[dataset_id], args.data_dir / "raw_pdfs", force=args.force
            )
    frame = extract_corpus(args.data_dir, datasets)
    if frame.empty:
        raise ValueError("No records extracted; existing outputs were preserved")
    labels = extract_ground_truth(frame, include_silver=True)
    manifest = {
        "format_version": 2,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "records": len(frame),
        "silver_labels": len(labels),
        "sources": [
            {
                "dataset_id": i,
                "url": SOURCES[i].url,
                "sha256": frame.loc[frame.dataset_id == i, "source_sha256"].iloc[0],
                "records": int(frame.dataset_id.eq(i).sum()),
            }
            for i in datasets
        ],
    }
    atomic_write(
        args.data_dir / "southampton_consultations_aggregated.parquet", frame.to_parquet
    )
    atomic_write(
        args.data_dir / "southampton_consultations_aggregated.csv",
        lambda p: frame.to_csv(p, index=False),
    )
    atomic_write(
        args.data_dir / "ground_truth_silver.csv",
        lambda p: labels.to_csv(p, index=False),
    )
    atomic_write(
        args.data_dir / "manifest.json",
        lambda p: p.write_text(json.dumps(manifest, indent=2) + "\n"),
    )
    print(
        (
            f"Saved {len(frame):,} records from {len(datasets)} sources; "
            f"{len(labels)} silver labels in {args.data_dir}"
        )
    )


if __name__ == "__main__":
    main()
