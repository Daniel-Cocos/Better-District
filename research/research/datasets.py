"""Whole-consultation splits, frozen memberships and dataset fingerprints."""

import hashlib
import json

import pandas as pd

from consultations import load_dataset
from .config import DataConfig

GROUPS = {
    "s77446_carparks": "carparks",
    "s59108_portswood_p1": "portswood",
    "psg29_portswood_log": "portswood",
    "media3131_portswood_p2": "portswood",
    "s50527_licensing": "licensing",
    "s69290_budget": "budget",
    "s57570_pna": "pna",
}


def fingerprint(frame: pd.DataFrame, columns: list[str]) -> str:
    """Hash stable, ordered JSON values for the selected dataset fields."""
    canonical = (
        frame.sort_values("comment_id")
        .filter(items=columns)
        .to_json(orient="records", double_precision=15)
    )
    return hashlib.sha256((canonical or "[]").encode()).hexdigest()


def prepare_data(config: DataConfig, seed: int = 42) -> tuple[pd.DataFrame, dict]:
    """Load eligible units, assign reproducible splits and record membership."""
    frame = load_dataset(
        config.data_dir,
        annotations=config.annotations,
        include_silver=config.include_silver_train,
    )
    frame["productive"] = frame.productive.astype("boolean")
    frame["consultation_group"] = frame.dataset_id.map(GROUPS)
    if frame.consultation_group.isna().any():
        raise ValueError("A source is missing its consultation-group mapping")
    unknown = (set(config.validation_groups) | set(config.test_groups)) - set(
        GROUPS.values()
    )
    if unknown:
        raise ValueError(f"Unknown consultation groups: {sorted(unknown)}")
    frame["productive"] = frame.productive.where(frame.label_scope.eq(config.scope))
    # A reviewed annotation is sufficient to make a candidate eligible; unreviewed
    # report blocks require an explicit opt-in for exploratory inference.
    if not config.include_candidates:
        frame = pd.DataFrame(
            frame.loc[
                frame.record_kind.eq("comment")
                | frame.label_quality.eq(config.reference_quality),
                :,
            ]
        ).copy()
    frame = frame.sort_values("comment_id").reset_index(drop=True)
    digest = fingerprint(
        frame,
        [
            "comment_id",
            "comment_text",
            "source_sha256",
            "productive",
            "label_quality",
            "label_scope",
        ],
    )
    _assign_splits(frame, config, digest, seed)
    # Silver labels never participate in threshold selection or test scoring.
    frame.loc[
        ~frame.split.eq("train") & ~frame.label_quality.eq(config.reference_quality),
        "productive",
    ] = pd.NA
    labelled = frame[frame.productive.notna()].copy()
    normalized = (
        labelled.comment_text.str.casefold()
        .str.replace(r"\W+", " ", regex=True)
        .str.strip()
    )
    if (
        labelled.assign(normalized=normalized)
        .groupby("normalized")
        .split.nunique()
        .gt(1)
        .any()
    ):
        raise ValueError(
            "Identical labelled text crosses split boundaries; revise the split"
        )
    manifest = {
        "dataset_fingerprint": digest,
        "scope": config.scope,
        "grouping": (
            "stratified with exact-text groups"
            if config.split_strategy == "stratified"
            else "whole consultation (all Portswood phases grouped together)"
        ),
        "reference_quality": config.reference_quality,
        "assignments": dict(zip(frame.comment_id, frame.split)),
        "counts": frame.groupby("split").size().to_dict(),
        "labelled_counts": frame[frame.productive.notna()]
        .groupby("split")
        .size()
        .to_dict(),
    }
    return frame, manifest


def _frozen_split(frame: pd.DataFrame, config: DataConfig, digest: str) -> None:
    assert config.splits_file is not None
    frozen = json.loads(config.splits_file.read_text())
    if frozen["dataset_fingerprint"] != digest:
        raise ValueError(
            "Frozen split fingerprint differs from the current data/labels"
        )
    assignments = frozen["assignments"]
    if set(assignments) != set(frame.comment_id):
        raise ValueError("Frozen split membership differs from the current corpus")
    frame["split"] = frame.comment_id.map(assignments)
    if not frame.split.isin(["train", "validation", "test"]).all():
        raise ValueError("Invalid frozen split name")


def _stratified_split(frame: pd.DataFrame, seed: int) -> None:
    from sklearn.model_selection import StratifiedGroupKFold

    if frame.productive.isna().any() or frame.productive.nunique() != 2:
        raise ValueError(
            (
                "Stratified benchmarking needs reference labels for every unit "
                "and both classes"
            )
        )
    groups = (
        frame.comment_text.str.casefold()
        .str.replace(r"\W+", " ", regex=True)
        .str.strip()
    )
    splitter = StratifiedGroupKFold(n_splits=5, shuffle=True, random_state=seed)
    remaining, _ = next(splitter.split(frame, frame.productive.astype(int), groups))
    inner = StratifiedGroupKFold(n_splits=4, shuffle=True, random_state=seed + 1)
    train, validation = next(
        inner.split(
            frame.iloc[remaining],
            frame.iloc[remaining].productive.astype(int),
            groups.iloc[remaining],
        )
    )
    frame["split"] = "test"
    frame.loc[remaining[train], "split"] = "train"
    frame.loc[remaining[validation], "split"] = "validation"


def _assign_splits(
    frame: pd.DataFrame, config: DataConfig, digest: str, seed: int
) -> None:
    if config.splits_file:
        _frozen_split(frame, config, digest)
    elif config.split_strategy == "stratified":
        _stratified_split(frame, seed)
    else:
        frame["split"] = "train"
        frame.loc[frame.consultation_group.isin(config.validation_groups), "split"] = (
            "validation"
        )
        frame.loc[frame.consultation_group.isin(config.test_groups), "split"] = "test"
    if (
        config.split_strategy == "consultation"
        and frame.groupby("consultation_group").split.nunique().gt(1).any()
    ):
        raise ValueError("A consultation appears in multiple splits")
