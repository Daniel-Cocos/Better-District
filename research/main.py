"""Small example: run `nix develop --command python main.py` after `make data`."""

from consultations import load_dataset


def main() -> None:
    """Parse command-line arguments and execute the requested operation."""
    df = load_dataset(include_silver=True)
    print(df.groupby(["dataset_id", "extraction_type"]).size())
    print(df[["comment_id", "comment_text", "productive", "label_quality"]].head())
    # Unknown labels stay null. Silver labels are opt-in, assumption-based positives.
    labelled = df[df.productive.notna()]
    print(f"{len(labelled)} labelled rows; review before using as an evaluation set.")


if __name__ == "__main__":
    main()
