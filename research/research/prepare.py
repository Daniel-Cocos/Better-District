"""Build the expanded, AI-labelled benchmark with a fresh matched test split."""

from pathlib import Path

import pandas as pd

from consultations import load_dataset
from consultations.schemas import GROUND_TRUTH_SCHEMA
from consultations.units import extract_comment_units

from .artifacts import write_json
from .config import DataConfig
from .datasets import prepare_data

ROOT = Path("benchmark")
CORPUS_FILE = "southampton_consultations_aggregated.parquet"
TEST_QUOTAS = {"1-5": 6, "6-12": 7, "13-20": 6, "21+": 1}
VALIDATION_QUOTAS = {"1-5": 4, "6-12": 4, "13-20": 4, "21+": 0}


def _length_band(words: int) -> str:
    if words <= 5:
        return "1-5"
    if words <= 12:
        return "6-12"
    return "13-20" if words <= 20 else "21+"


def _unique_units(units: pd.DataFrame, previous_ids: set[str]) -> pd.DataFrame:
    frame = units.copy()
    frame["previous"] = frame.comment_id.isin(previous_ids)
    frame["normalized"] = (
        frame.comment_text.str.casefold()
        .str.replace(r"\W+", " ", regex=True)
        .str.strip()
    )
    selected = frame.sort_values(
        ["previous", "comment_id"], ascending=[False, True]
    ).drop_duplicates("normalized")
    if not previous_ids.issubset(set(selected.comment_id)):
        raise ValueError("Deduplication would remove an original benchmark comment")
    return selected.drop(columns=["previous", "normalized"]).reset_index(drop=True)


def _reserve(
    frame: pd.DataFrame, quotas: dict[str, int], split: str, seed: int
) -> None:
    for productive in [False, True]:
        for band, size in quotas.items():
            eligible = pd.DataFrame(
                frame.loc[
                    ~frame.previous
                    & frame.split.eq("train")
                    & frame.productive.eq(productive)
                    & frame.length_band.eq(band),
                    :,
                ]
            )
            if len(eligible) < size:
                raise ValueError(
                    f"Too few {productive=} comments in length band {band}"
                )
            chosen = eligible.sort_values("comment_id").sample(
                n=size, random_state=seed
            )
            frame.loc[chosen.index, "split"] = split


def _freeze_splits(previous_ids: set[str]) -> None:
    config = DataConfig(
        data_dir=ROOT / "data",
        annotations=ROOT / "labels.csv",
        reference_quality="ai_reference",
        split_strategy="stratified",
    )
    frame, manifest = prepare_data(config)
    frame["previous"] = frame.comment_id.isin(previous_ids)
    frame["length_band"] = frame.word_count.map(_length_band)
    frame["split"] = "train"
    _reserve(frame, TEST_QUOTAS, "test", 42)
    _reserve(frame, VALIDATION_QUOTAS, "validation", 43)
    manifest.update(
        assignments=dict(zip(frame.comment_id, frame.split)),
        counts=frame.groupby("split").size().to_dict(),
        labelled_counts=frame.groupby("split").size().to_dict(),
        grouping="Unique text; fresh test/validation matched by label and length band",
        selection=(
            "Targeted AI-reviewed real comments, including bare stances and insults. "
            "Balanced evaluation is a challenge sample, not population prevalence."
        ),
        previous_comments="All original benchmark comments are training-only",
        test_word_count_quotas_per_class=TEST_QUOTAS,
        validation_word_count_quotas_per_class=VALIDATION_QUOTAS,
        rubric="productivity-v1.0; no model predictions used in selection or labelling",
    )
    write_json(ROOT / "splits.json", manifest)
    config.splits_file = ROOT / "splits.json"
    verified, _ = prepare_data(config)
    assert (
        verified.loc[verified.split.eq("test"), "productive"]
        .value_counts()
        .eq(20)
        .all()
    )
    assert (
        not verified.loc[~verified.split.eq("train"), "comment_id"]
        .isin(previous_ids)
        .any()
    )
    print(frame.groupby(["split", "productive"]).size().to_string())


def main() -> None:
    """Extract labelled units, remove duplicate new text and freeze fresh splits."""
    previous_ids = set(pd.read_parquet(ROOT / "previous/data" / CORPUS_FILE).comment_id)
    labels = GROUND_TRUTH_SCHEMA.validate(pd.read_csv(ROOT / "labels.csv"), lazy=True)
    extracted, _ = extract_comment_units()
    units = pd.DataFrame(extracted.loc[extracted.comment_id.isin(labels.comment_id), :])
    if set(units.comment_id) != set(labels.comment_id):
        raise ValueError("Some reference labels do not match extracted source units")
    units = _unique_units(units, previous_ids)
    selected_labels = pd.DataFrame(
        labels.loc[labels.comment_id.isin(units.comment_id), :]
    )
    selected_labels.to_csv(ROOT / "labels.csv", index=False)
    units.to_parquet(ROOT / "data" / CORPUS_FILE, index=False)
    load_dataset(ROOT / "data", annotations=ROOT / "labels.csv")
    _freeze_splits(previous_ids)


if __name__ == "__main__":
    main()
