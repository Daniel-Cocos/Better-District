"""Hugging Face encoder fine-tuning with explicit truncation and saved weights."""

from pathlib import Path
from typing import Any

import pandas as pd
from pydantic import Field

from research.config import StrictModel

from .base import BaseClassifier


class EncoderSettings(StrictModel):
    """Validated encoder settings supplied by the experiment YAML."""

    model_name: str = "microsoft/deberta-v3-small"
    revision: str = "main"
    epochs: int = Field(default=3, gt=0)
    learning_rate: float = Field(default=2e-5, gt=0)
    batch_size: int = Field(default=8, gt=0)
    max_length: int = Field(default=512, gt=0)
    device: str = "cpu"
    local_files_only: bool = False
    cache_dir: str = ".cache/huggingface"
    cpu_threads: int = Field(default=2, gt=0)


class DebertaClassifier(BaseClassifier):
    """Fine-tune a two-class encoder and expose single-comment inference."""

    requires_training = True

    def __init__(self, *, seed: int = 42, **settings: Any) -> None:
        super().__init__(seed=seed)
        self.settings = EncoderSettings(**settings)
        self.metadata.update(
            self.settings.model_dump(), truncation="first max_length tokens"
        )
        # Transformers returns architecture-specific model/tokenizer objects
        # dynamically.
        self.model: Any = None
        self.tokenizer: Any = None

    def _load(self) -> None:
        import torch
        from transformers import (
            AutoModelForSequenceClassification,
            AutoTokenizer,
            set_seed,
        )

        options = self.settings
        set_seed(self.seed)
        if options.device == "cpu":
            torch.set_num_threads(options.cpu_threads)
        common: dict[str, Any] = {
            "revision": options.revision,
            "local_files_only": options.local_files_only,
            "cache_dir": options.cache_dir,
        }
        self.tokenizer = AutoTokenizer.from_pretrained(options.model_name, **common)
        self.model = AutoModelForSequenceClassification.from_pretrained(
            options.model_name,
            **common,
            num_labels=2,
            dtype=torch.float32,
            id2label={0: "unproductive", 1: "productive"},
            label2id={"unproductive": 0, "productive": 1},
        ).to(options.device)
        self.metadata.update(
            resolved_commit=getattr(self.model.config, "_commit_hash", None),
            training_dtype=str(next(self.model.parameters()).dtype),
        )

    def _tokenize(self, texts: str | list[str]) -> Any:
        return self.tokenizer(
            texts,
            padding=True,
            truncation=True,
            max_length=self.settings.max_length,
            return_tensors="pt",
        ).to(self.settings.device)

    def _train_batch(self, batch: pd.DataFrame, optimizer: Any) -> float:
        import torch

        labels = torch.tensor(
            batch.productive.astype(int).tolist(), device=self.settings.device
        )
        optimizer.zero_grad()
        loss = self.model(
            **self._tokenize(batch.comment_text.tolist()), labels=labels
        ).loss
        if not torch.isfinite(loss):
            raise ValueError("Non-finite encoder training loss")
        loss.backward()
        torch.nn.utils.clip_grad_norm_(
            self.model.parameters(), 1.0, error_if_nonfinite=True
        )
        optimizer.step()
        return float(loss.detach().cpu())

    def _train_epoch(
        self, train: pd.DataFrame, optimizer: Any, generator: Any
    ) -> float:
        import torch

        order = torch.randperm(len(train), generator=generator).tolist()
        size = self.settings.batch_size
        losses = [
            self._train_batch(train.iloc[order[start : start + size]], optimizer)
            for start in range(0, len(order), size)
        ]
        return sum(losses) / len(losses)

    def fit(self, train: pd.DataFrame, validation: pd.DataFrame) -> None:
        """Load pretrained weights and train for the configured number of epochs."""
        import torch

        del validation
        self._load()
        optimizer = torch.optim.AdamW(
            self.model.parameters(), lr=self.settings.learning_rate
        )
        generator = torch.Generator().manual_seed(self.seed)
        self.model.train()
        self.metadata["training_loss"] = [
            self._train_epoch(train, optimizer, generator)
            for _ in range(self.settings.epochs)
        ]
        self.model.eval()

    def predict_one(self, text: str) -> dict[str, Any]:
        """Return the productive-class probability for one truncated comment."""
        import torch

        if self.model is None:
            raise RuntimeError("Call fit() before encoder prediction")
        with torch.inference_mode():
            score = float(
                self.model(**self._tokenize(text)).logits.softmax(-1)[0, 1].cpu()
            )
        return {"productive": score >= 0.5, "score": score}

    def save(self, directory: Path) -> None:
        """Save run metadata, fine-tuned weights, and the matching tokenizer."""
        super().save(directory)
        if self.model is not None:
            self.model.save_pretrained(directory / "checkpoint")
            self.tokenizer.save_pretrained(directory / "checkpoint")
