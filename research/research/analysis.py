"""Rebuild a benchmark story figure and per-comment comparison from saved runs."""

import argparse
import json
from pathlib import Path
from typing import Any

import pandas as pd
from matplotlib.backends.backend_agg import FigureCanvasAgg
from matplotlib.figure import Figure

from .plots import save_figure

NAMES = {
    "always_positive": "Keep everything (baseline)",
    "heuristic": "Keyword heuristic (baseline)",
    "lightgbm": "LightGBM",
    "deberta": "DeBERTa-v3-small",
    "zero_shot": "Qwen3 1.7B · zero-shot",
    "dspy": "Qwen3 1.7B · DSPy",
    "laya": "Laya",
}


def _load_runs(directory: Path) -> list[dict[str, Any]]:
    entries = json.loads((directory / "runs.json").read_text(encoding="utf-8"))
    rows = []
    fingerprints = set()
    for entry in entries:
        if entry["status"] not in {"completed", "completed_with_errors"}:
            raise ValueError(f"Cannot analyse an incomplete run: {entry['model']}")
        run_dir = Path(entry["run_dir"])
        metadata = json.loads((run_dir / "run.json").read_text(encoding="utf-8"))
        metrics = json.loads((run_dir / "metrics.json").read_text(encoding="utf-8"))
        fingerprints.add((metadata["evaluation_fingerprint"], metadata["scope"]))
        rows.append({**entry, **metrics})
    if not rows or len(fingerprints) != 1:
        raise ValueError("Analysis requires one shared evaluation population")
    return rows


def _counts_panel(axis: Any, rows: list[dict[str, Any]], positive: bool) -> None:
    count = "tp" if positive else "tn"
    support = "positive_support" if positive else "negative_support"
    total = rows[0][support]
    values = [row[count] for row in rows]
    axis.barh(range(len(rows)), values, color="#247c8a" if positive else "#c87935")
    for index, value in enumerate(values):
        axis.text(value + total * 0.025, index, f"{value}/{total}", va="center")
    axis.set_xlim(0, max(total, 1) * 1.28)
    axis.set_xticks(range(0, total + 1, max(1, total // 4)))
    axis.set_title(
        "Useful comments kept" if positive else "Unproductive comments filtered"
    )
    axis.set_xlabel("Higher is better")
    axis.set_yticks(range(len(rows)))
    axis.set_yticklabels([NAMES[row["model"]] for row in rows] if positive else [])
    axis.invert_yaxis()
    axis.spines[["top", "right", "left"]].set_visible(False)
    axis.tick_params(axis="y", length=0)
    axis.set_axisbelow(True)
    axis.grid(axis="x", alpha=0.15)


def _latency_panel(axis: Any, rows: list[dict[str, Any]]) -> None:
    values = [row["latency_ms_p50"] for row in rows]
    axis.barh(range(len(rows)), values, color="#737e8c")
    axis.set_xscale("log")
    axis.set_xlim(min(values) / 2, max(values) * 15)
    for index, value in enumerate(values):
        label = f"{value / 1000:.2f} s" if value >= 1000 else f"{value:.3g} ms"
        axis.text(value * 1.3, index, label, va="center")
    axis.set_title("Median time per comment")
    axis.set_xlabel("Milliseconds · log scale · lower is better")
    axis.set_yticks([])
    axis.invert_yaxis()
    axis.spines[["top", "right", "left"]].set_visible(False)
    axis.set_axisbelow(True)
    axis.grid(axis="x", alpha=0.15)


def story_figure(rows: list[dict[str, Any]], directory: Path) -> Path:
    """Show useful-comment retention, noise filtering and measured local latency."""
    figure = Figure(figsize=(14, 6), facecolor="white")
    FigureCanvasAgg(figure)
    axes = [figure.add_subplot(1, 3, index) for index in range(1, 4)]
    _counts_panel(axes[0], rows, positive=True)
    _counts_panel(axes[1], rows, positive=False)
    _latency_panel(axes[2], rows)
    figure.suptitle("Keep useful feedback, filter unhelpful comments", fontsize=18)
    positive, negative = rows[0]["positive_support"], rows[0]["negative_support"]
    failures = sum(row["n_failed"] for row in rows)
    figure.text(
        0.01,
        -0.04,
        f"Same held-out split: {positive} productive + {negative} "
        "unproductive comments. "
        f"AI reference labels; {failures} failed predictions across all runs.\n"
        f"Small PoC: only {negative} negatives; filtering reliability is uncertain. "
        "Latency excludes model loading, training and DSPy optimization.",
        fontsize=10,
        color="#454b54",
    )
    target = directory / "story"
    save_figure(figure, target)
    return target.with_suffix(".png")


def _score_groups(rows: list[dict[str, Any]]) -> dict[tuple[float, float], list[str]]:
    groups: dict[tuple[float, float], list[str]] = {}
    for row in rows:
        if row["precision"] is None or row["recall"] is None:
            raise ValueError("Precision and recall must be defined for every model")
        key = (float(row["precision"]), float(row["recall"]))
        groups.setdefault(key, []).append(row["model"])
    return groups


def _score_label(models: list[str]) -> str:
    return "\n".join(NAMES[model] for model in models)


def precision_recall_figure(rows: list[dict[str, Any]], directory: Path) -> Path:
    """Plot saved operating points, sharing one dot when model scores coincide."""
    directory.mkdir(parents=True, exist_ok=True)
    figure = Figure(figsize=(10, 7), facecolor="white")
    FigureCanvasAgg(figure)
    axis = figure.add_subplot()
    for index, ((precision, recall), models) in enumerate(_score_groups(rows).items()):
        label = _score_label(models)
        axis.scatter(
            precision,
            recall,
            s=100,
            color=f"C{index}",
            zorder=3,
            label=f"{label}\n{precision:.1%} precision · {recall:.1%} recall",
        )
    axis.legend(
        loc="upper left",
        bbox_to_anchor=(1.02, 1),
        frameon=False,
        borderaxespad=0,
        fontsize=10,
        labelspacing=1,
    )
    figure.suptitle(f"Precision and recall on {rows[0]['n_test']} test comments")
    axis.set(
        xlim=(0, 1.06),
        ylim=(0, 1.06),
        xlabel="Precision: how many kept comments were useful",
        ylabel="Recall: how many useful comments were kept",
    )
    axis.set_xticks(
        [0, 0.2, 0.4, 0.6, 0.8, 1], ["0%", "20%", "40%", "60%", "80%", "100%"]
    )
    axis.set_yticks(
        [0, 0.2, 0.4, 0.6, 0.8, 1], ["0%", "20%", "40%", "60%", "80%", "100%"]
    )
    axis.grid(alpha=0.15)
    axis.spines[["top", "right"]].set_visible(False)
    figure.text(
        0.02,
        -0.025,
        "Higher and farther right is better. Models with the same scores share a dot.\n"
        f"{rows[0]['positive_support']} useful + "
        f"{rows[0]['negative_support']} unhelpful comments. "
        "AI reference labels; see findings for how the sample was selected.",
        fontsize=10,
        color="#454b54",
    )
    target = directory / "precision_recall"
    save_figure(figure, target)
    return target.with_suffix(".png")


def case_comparison(rows: list[dict[str, Any]], directory: Path) -> Path:
    """Save every held-out comment with all model decisions and failure details."""
    frames = []
    for row in rows:
        frame = pd.read_parquet(Path(row["run_dir"]) / "predictions.parquet")
        frame["model"] = row["model"]
        frame["correct"] = frame.productive.eq(frame.productive_true).astype("boolean")
        frame.loc[frame.error.notna(), "correct"] = pd.NA
        frames.append(frame)
    target = directory / "case_predictions.csv"
    pd.concat(frames, ignore_index=True).to_csv(target, index=False)
    return target


def main() -> None:
    """Generate the story graphic and case table from a completed benchmark suite."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "directory", nargs="?", type=Path, default=Path("benchmark/results")
    )
    parser.add_argument("--figure-dir", type=Path)
    args = parser.parse_args()
    directory = args.directory
    rows = _load_runs(directory)
    print(story_figure(rows, directory))
    print(case_comparison(rows, directory))
    print(precision_recall_figure(rows, args.figure_dir or directory / "figures"))


if __name__ == "__main__":
    main()
