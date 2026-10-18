"""One command to compare the PoC models against the saved AI reference labels."""

import json
from pathlib import Path

import pandas as pd

from .config import load_config
from .models import REGISTRY
from .reporting import compare_runs
from .runner import run_experiment

DEFAULT_MODELS = list(REGISTRY)


def benchmark(models=None, out_dir=Path("benchmark/results")):
    """Run the selected models and save comparable benchmark results."""
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    completed, results = [], []
    for name in models or DEFAULT_MODELS:
        print(f"Running {name}...", flush=True)
        config = load_config(Path("experiments") / f"{name}.yaml")
        directory = run_experiment(config)
        run = json.loads((directory / "run.json").read_text())
        row = {"model": name, "status": run["status"], "run_dir": str(directory)}
        if run["status"] in {"completed", "completed_with_errors"}:
            completed.append(directory)
            metrics = json.loads((directory / "metrics.json").read_text())
            row.update(
                {
                    key: metrics.get(key)
                    for key in [
                        "n_test",
                        "positive_support",
                        "negative_support",
                        "precision",
                        "recall",
                        "specificity",
                        "balanced_accuracy",
                        "f1",
                        "fp",
                        "fn",
                        "n_failed",
                        "latency_ms_p50",
                    ]
                }
            )
            row["fit_seconds"] = run["fit_seconds"]
        else:
            row["error"] = run.get("error", run.get("artifact_error"))
        results.append(row)
        pd.DataFrame(results).to_csv(out_dir / "results.csv", index=False)
        print(f"{name}: {row['status']} — {directory}", flush=True)
    if completed:
        compare_runs(completed, out_dir)
    (out_dir / "runs.json").write_text(
        json.dumps(results, indent=2, allow_nan=False) + "\n"
    )
    print(pd.DataFrame(results).to_string(index=False))
    return results
