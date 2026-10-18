"""Explicit, revision-resolved Hugging Face asset downloads for encoder runs."""

import json
from pathlib import Path


def fetch_model(
    model_name="microsoft/deberta-v3-small",
    revision="main",
    cache_dir=Path(".cache/huggingface"),
):
    """Download model assets and record their resolved Hugging Face revision."""
    from huggingface_hub import HfApi, snapshot_download

    info = HfApi().model_info(model_name, revision=revision)
    commit = info.sha
    target = snapshot_download(
        repo_id=model_name,
        revision=commit,
        cache_dir=cache_dir,
        allow_patterns=[
            "*.json",
            "*.model",
            "*.txt",
            "*.safetensors",
            "pytorch_model.bin",
        ],
    )
    cache_dir.mkdir(parents=True, exist_ok=True)
    record = {
        "model_name": model_name,
        "requested_revision": revision,
        "resolved_revision": commit,
        "path": target,
    }
    safe_name = model_name.replace("/", "--")
    (cache_dir / f"{safe_name}.json").write_text(json.dumps(record, indent=2) + "\n")
    return record
