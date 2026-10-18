"""Command-line entry point for benchmark experiments."""

import argparse
import json
from pathlib import Path
import sys

from .config import load_config
from .models import REGISTRY
from .reporting import compare_runs, render_report
from .runner import run_experiment


def main():
    """Parse command-line arguments and execute the requested operation."""
    parser = argparse.ArgumentParser(description="Consultation classification research")
    sub = parser.add_subparsers(dest="command", required=True)
    run = sub.add_parser("run", help="Run one YAML-configured experiment")
    run.add_argument("config", type=Path)
    run.add_argument(
        "--model-name", help="Override model identifier, e.g. ollama_chat/your-model"
    )
    run.add_argument("--out-dir", type=Path)
    run.add_argument("--annotations", type=Path)
    run.add_argument(
        "--splits",
        type=Path,
        help="Reuse a frozen splits.json with matching dataset fingerprint",
    )
    report = sub.add_parser(
        "report", help="Regenerate a run report and figures without model calls"
    )
    report.add_argument("run_dir", type=Path)
    report.add_argument("--template", type=Path)
    compare = sub.add_parser("compare", help="Compare runs on the same evaluation data")
    compare.add_argument("run_dirs", nargs="+", type=Path)
    compare.add_argument("--out-dir", type=Path, required=True)
    batch = sub.add_parser("benchmark", help="Run the PoC model comparison")
    batch.add_argument(
        "--models",
        nargs="+",
        choices=list(REGISTRY),
    )
    batch.add_argument("--out-dir", type=Path, default=Path("benchmark/results"))
    fetch = sub.add_parser(
        "fetch",
        help=(
            "Download encoder assets from Hugging Face and record the "
            "resolved revision"
        ),
    )
    fetch.add_argument("--model", default="microsoft/deberta-v3-small")
    fetch.add_argument("--revision", default="main")
    fetch.add_argument("--cache-dir", type=Path, default=Path(".cache/huggingface"))
    args = parser.parse_args()
    if args.command == "run":
        config = load_config(args.config, args.model_name)
        if args.out_dir:
            config.output_dir = args.out_dir
        if args.annotations:
            config.data.annotations = args.annotations
        if args.splits:
            config.data.splits_file = args.splits
        directory = run_experiment(config)
        run_data = json.loads((directory / "run.json").read_text())
        print(f"{run_data['status']}: {directory}")
        if run_data["status"] == "failed":
            print(
                run_data.get("error", run_data.get("artifact_error")), file=sys.stderr
            )
            return 1
    elif args.command == "report":
        print(render_report(args.run_dir, args.template))
    elif args.command == "compare":
        print(compare_runs(args.run_dirs, args.out_dir))
    elif args.command == "benchmark":
        from .benchmark import benchmark

        results = benchmark(args.models, args.out_dir)
        return int(any(r["status"] == "failed" for r in results))
    elif args.command == "fetch":
        from .hub import fetch_model

        print(
            json.dumps(fetch_model(args.model, args.revision, args.cache_dir), indent=2)
        )
    return 0


if __name__ == "__main__":
    sys.exit(main())
