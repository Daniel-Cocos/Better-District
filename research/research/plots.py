"""Headless figures generated from saved benchmark predictions and metrics."""

import json
from pathlib import Path
from typing import Any

import pandas as pd
from matplotlib.figure import Figure
from matplotlib.backends.backend_agg import FigureCanvasAgg


def _figure(size: tuple[int, int]) -> Figure:
    figure = Figure(figsize=size)
    FigureCanvasAgg(figure)
    return figure


def save_figure(fig: Figure, path: Path) -> None:
    """Write a figure as PNG and SVG, then release its artists."""
    fig.tight_layout()
    for suffix in [".png", ".svg"]:
        fig.savefig(path.with_suffix(suffix), dpi=180, bbox_inches="tight")
    fig.clear()


def run_figures(directory: Path) -> list[str]:
    """Generate distribution, confusion and cost plots from saved results."""
    path = directory / "predictions.parquet"
    if not path.exists():
        return []
    frame = pd.read_parquet(path)
    metrics = json.loads((directory / "metrics.json").read_text())
    figures = directory / "figures"
    figures.mkdir(exist_ok=True)
    _distribution(frame, figures)
    _confusion(metrics, figures)
    _cost_plot(pd.read_csv(directory / "cost_sensitivity.csv"), metrics, figures)
    return ["predictions.png", "confusion.png", "cost_sensitivity.png"]


def comparison_figure(rows: list[dict[str, Any]], out_dir: Path) -> None:
    """Plot quality, latency and coverage for comparable runs."""
    fig = _figure((14, 4))
    axes = [fig.add_subplot(1, 3, index) for index in range(1, 4)]
    names = [f"{r['name']}\n{r['run_id'][-8:]}" for r in rows]
    if all(r["both_classes"] for r in rows):
        x = list(range(len(rows)))
        axes[0].bar(
            [i - 0.18 for i in x],
            [r["precision"] or 0 for r in rows],
            width=0.36,
            label="Precision",
        )
        axes[0].bar(
            [i + 0.18 for i in x],
            [r["recall"] or 0 for r in rows],
            width=0.36,
            label="Recall",
        )
        axes[0].set(
            xticks=x,
            xticklabels=names,
            ylim=(0, 1),
            title="Test agreement with reference labels",
        )
        axes[0].legend()
    else:
        axes[0].set_axis_off()
        axes[0].text(
            0.5,
            0.5,
            (
                "Quality comparison unavailable\nPositive and negative\ntest "
                "examples required"
            ),
            ha="center",
            va="center",
            transform=axes[0].transAxes,
        )
    axes[1].bar(names, [r["latency_ms_p50"] for r in rows], color="#297d76")
    if all(r["latency_ms_p50"] and r["latency_ms_p50"] > 0 for r in rows):
        axes[1].set_yscale("log")
    axes[1].set(
        title="Median per-comment latency (log scale)",
        ylabel="Milliseconds (includes local adapter overhead)",
    )
    axes[2].bar(names, [r["coverage"] for r in rows], color="#cf8d48")
    axes[2].set(
        title="Prediction coverage", ylabel="Successful fraction", ylim=(0, 1.05)
    )
    save_figure(fig, out_dir / "comparison")


def _distribution(frame: pd.DataFrame, figures: Path) -> None:
    fig = _figure((7, 4))
    ax = fig.add_subplot()
    counts = [
        int((frame.productive.eq(True) & frame.error.isna()).sum()),
        int((frame.productive.eq(False) & frame.error.isna()).sum()),
        int(frame.error.notna().sum()),
    ]
    ax.bar(
        ["Productive", "Unproductive", "Failed"],
        counts,
        color=["#297d76", "#cf8d48", "#b24e56"],
    )
    ax.set(
        ylabel="Predictions", title="Prediction distribution — not an accuracy measure"
    )
    save_figure(fig, figures / "predictions")


def _confusion(metrics: dict[str, Any], figures: Path) -> None:
    fig = _figure((5, 4))
    ax = fig.add_subplot()
    if metrics["n_scored"]:
        values = [[metrics["tn"], metrics["fp"]], [metrics["fn"], metrics["tp"]]]
        ax.imshow(values, cmap="Blues")
        for i in range(2):
            for j in range(2):
                ax.text(j, i, str(values[i][j]), ha="center", va="center")
        ax.set(
            xticks=[0, 1],
            yticks=[0, 1],
            xticklabels=["Unproductive", "Productive"],
            yticklabels=["Unproductive", "Productive"],
            xlabel="Predicted",
            ylabel="Reference label",
            title=(
                f"Confusion counts ({metrics['n_scored']} successful "
                "labelled predictions)"
            ),
        )
    else:
        ax.set_axis_off()
        ax.text(
            0.5,
            0.5,
            "No test labels\nQuality evaluation unavailable",
            ha="center",
            va="center",
            transform=ax.transAxes,
        )
    save_figure(fig, figures / "confusion")


def _cost_plot(costs: pd.DataFrame, metrics: dict[str, Any], figures: Path) -> None:
    fig = _figure((6, 4))
    ax = fig.add_subplot()
    if not costs.empty and metrics["both_classes"]:
        ax.plot(
            costs.fn_cost_ratio, costs.cost_per_1000_scored, marker="o", color="#297d76"
        )
        ax.set(
            xlabel="Cost of a false negative relative to a false positive",
            ylabel="Decision cost per 1,000 scored comments",
            title="Decision cost sensitivity (successful labelled predictions)",
        )
    else:
        ax.set_axis_off()
        ax.text(
            0.5,
            0.5,
            "Examples of both classes required\nfor decision cost comparison",
            ha="center",
            va="center",
            transform=ax.transAxes,
        )
    save_figure(fig, figures / "cost_sensitivity")
