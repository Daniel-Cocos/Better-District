"""Run pinned Laya weights locally, or use an existing loopback HTTP service."""

import json
from pathlib import Path
from typing import Any
from urllib.parse import urlparse
from urllib.request import Request, urlopen

import pandas as pd
from pydantic import Field

from research.config import StrictModel

from .base import BaseClassifier
from .llm import RUBRIC, RUBRIC_VERSION

MODEL = "convaiinnovations/laya"
REVISION = "7b928d828b7b0e022f929d9bd2e44165aa270148"


class LayaSettings(StrictModel):
    """Local checkpoint and optional HTTP transport configuration."""

    model_name: str = MODEL
    revision: str = REVISION
    device: str = "cpu"
    cpu_threads: int = Field(default=2, gt=0)
    max_length: int = Field(default=512, gt=0)
    cache_dir: str = ".cache/huggingface"
    local_files_only: bool = False
    api_base: str | None = None
    timeout: float = 60
    rubric: str = RUBRIC


class LayaClassifier(BaseClassifier):
    """Expose Laya's typed choices through the common dataframe interface."""

    def __init__(self, *, seed: int = 42, **settings: Any) -> None:
        super().__init__(seed=seed)
        self.settings = LayaSettings(**settings)
        options = self.settings
        if options.api_base and urlparse(options.api_base).hostname not in {
            "localhost",
            "127.0.0.1",
            "::1",
        }:
            raise ValueError("Use a local Laya endpoint")
        self.agent: Any = None  # Laya publishes a dynamically loaded checkpoint API.
        self.questions = {
            "productivity": {
                "type": "choice",
                "instructions": options.rubric,
                "criteria": {
                    "productive": (
                        "Provides a specific issue, reason, "
                        "impact, experience or suggestion"
                    ),
                    "unproductive": (
                        "Provides no usable issue or " "information for the decision"
                    ),
                },
            }
        }
        self.metadata.update(
            options.model_dump(),
            backend="http" if options.api_base else "local",
            rubric_version=RUBRIC_VERSION if options.rubric == RUBRIC else "custom",
            long_inputs="Overlapping windows; score comes from the selected window",
            score_semantics="Productive-option probability, not assumed calibrated",
        )

    def fit(self, train: pd.DataFrame, validation: pd.DataFrame) -> None:
        """Load cached or downloaded checkpoint weights without fine-tuning them."""
        del train, validation
        if self.settings.api_base:
            return
        import laya
        import torch
        from huggingface_hub import snapshot_download

        options = self.settings
        if options.device == "cpu":
            torch.set_num_threads(options.cpu_threads)
        snapshot = snapshot_download(
            options.model_name,
            revision=options.revision,
            cache_dir=options.cache_dir,
            local_files_only=options.local_files_only,
            allow_patterns=[
                "rl_agent_config.json",
                "model.safetensors",
                "tokenizer/*",
                "encoder/*",
            ],
        )
        self.agent = laya.load(snapshot, device=options.device)
        self.agent.cfg["max_len"] = options.max_length
        self.metadata.update(
            resolved_revision=Path(snapshot).name,
            laya_version=laya.__version__,
            actual_device=str(self.agent.device),
        )

    def _response(self, text: str) -> dict[str, Any]:
        if self.settings.api_base:
            body = {
                "model": self.settings.model_name,
                "state": {"body": text},
                "questions": self.questions,
            }
            request = Request(
                self.settings.api_base.rstrip("/") + "/v1/systemone",
                data=json.dumps(body).encode(),
                headers={"Content-Type": "application/json"},
            )
            with urlopen(request, timeout=self.settings.timeout) as response:
                return json.load(response)
        if self.agent is None:
            raise RuntimeError(
                "Call fit() to load the local Laya model before prediction"
            )
        return self.agent.predict_long(
            {"body": text}, self.questions, window=self.settings.max_length
        )

    def predict_one(self, text: str) -> dict[str, Any]:
        """Return the selected choice, its probability, usage, and raw output."""
        self.last_raw = self._response(text)
        answer = self.last_raw["answers"]["productivity"]
        if answer.get("abstention"):
            raise ValueError("Laya abstained")
        choice = answer["choice"]
        if choice not in {"productive", "unproductive"}:
            raise ValueError(f"Unknown Laya choice: {choice!r}")
        usage = self.last_raw.get("usage", {})
        return {
            "productive": choice == "productive",
            "score": answer.get("probabilities", {}).get("productive"),
            "input_tokens": usage.get("input_tokens"),
            "output_tokens": usage.get("output_tokens"),
            "raw": self.last_raw,
        }
