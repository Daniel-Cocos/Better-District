"""JSON artifacts and environment fingerprints for saved experiment runs."""

import hashlib
import json
import platform
from importlib.metadata import PackageNotFoundError, version
from pathlib import Path
from typing import Any


def write_json(path: str | Path, value: Any) -> None:
    """Serialize a JSON artifact, rejecting non-finite numeric values."""
    Path(path).write_text(
        json.dumps(value, indent=2, default=str, allow_nan=False) + "\n",
        encoding="utf-8",
    )


def environment() -> dict[str, Any]:
    """Record package versions and fingerprints of the code and Nix lock file."""
    packages = {}
    for name in [
        "pandas",
        "pandera",
        "numpy",
        "scikit-learn",
        "lightgbm",
        "torch",
        "transformers",
        "huggingface-hub",
        "litellm",
        "dspy",
        "laya",
        "Jinja2",
        "matplotlib",
    ]:
        try:
            packages[name] = version(name)
        except PackageNotFoundError:
            packages[name] = None
    root = Path(__file__).resolve().parent.parent
    files = [
        *root.glob("research/**/*.py"),
        *root.glob("research/templates/*"),
        *root.glob("consultations/*.py"),
        root / "flake.lock",
        root / "flake.nix",
    ]
    digest = hashlib.sha256()
    for path in sorted(files):
        digest.update(str(path.relative_to(root)).encode())
        digest.update(path.read_bytes())
    return {
        "python": platform.python_version(),
        "platform": platform.platform(),
        "packages": packages,
        "code_fingerprint": digest.hexdigest(),
        "flake_lock_sha256": hashlib.sha256(
            (root / "flake.lock").read_bytes()
        ).hexdigest(),
    }
