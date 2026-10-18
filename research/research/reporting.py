"""Render Jinja reports and compare saved run artifacts."""

import json
from pathlib import Path

import pandas as pd
from jinja2 import Environment, FileSystemLoader, StrictUndefined

from .plots import comparison_figure, run_figures

TEMPLATES = Path(__file__).with_name("templates")


def render_report(directory: Path, template: Path | None = None) -> Path:
    """Render a run report using its saved metadata, metrics and figures."""
    directory = Path(directory)
    run = json.loads((directory / "run.json").read_text())
    config = json.loads((directory / "config.json").read_text())
    metrics_path = directory / "metrics.json"
    metrics = json.loads(metrics_path.read_text()) if metrics_path.exists() else {}
    figures = run_figures(directory)
    selected = template or TEMPLATES / "run.html.j2"
    env = Environment(
        loader=FileSystemLoader(selected.parent),
        undefined=StrictUndefined,
        autoescape=True,
    )
    html = env.get_template(selected.name).render(
        run=run, config=config, metrics=metrics, figures=figures
    )
    target = directory / "report.html"
    target.write_text(html)
    return target


def compare_runs(directories: list[Path], out_dir: Path) -> Path:
    """Compare only runs with identical test inputs, labels and target scope."""
    rows = []
    fingerprints = set()
    for directory in directories:
        run = json.loads((directory / "run.json").read_text())
        if run["status"] not in {"completed", "completed_with_errors"}:
            raise ValueError(f"{directory}: only completed runs can be compared")
        metrics = json.loads((directory / "metrics.json").read_text())
        fingerprints.add((run["evaluation_fingerprint"], run["scope"]))
        rows.append(
            {
                "run_id": run["run_id"],
                "name": run["name"],
                "model": run["model"],
                "scope": run["scope"],
                "evaluation_fingerprint": run["evaluation_fingerprint"],
                **metrics,
            }
        )
    if not rows or len(fingerprints) != 1:
        raise ValueError(
            "Comparison requires runs with identical evaluation fingerprints"
        )
    out_dir.mkdir(parents=True, exist_ok=True)
    frame = pd.DataFrame(rows)
    frame.to_csv(out_dir / "comparison.csv", index=False)
    (out_dir / "comparison.json").write_text(
        json.dumps(rows, indent=2, allow_nan=False) + "\n"
    )
    comparison_figure(rows, out_dir)
    env = Environment(
        loader=FileSystemLoader(TEMPLATES), undefined=StrictUndefined, autoescape=True
    )
    (out_dir / "report.html").write_text(
        env.get_template("comparison.html.j2").render(rows=rows)
    )
    return out_dir / "comparison.png"
