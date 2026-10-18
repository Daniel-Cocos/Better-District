"""Local Ollama inference through LiteLLM with validated JSON decisions."""

import json
from pathlib import Path
from typing import Any, cast
from urllib.parse import urlparse

from jinja2 import Environment, FileSystemLoader, StrictUndefined

from research.config import StrictModel
from research.rubric import PROMPT_RUBRIC as RUBRIC
from research.rubric import RUBRIC_VERSION

from .base import BaseClassifier


class OllamaSettings(StrictModel):
    """Connection and generation settings shared by local Ollama adapters."""

    model_name: str
    api_base: str = "http://localhost:11434"
    temperature: float = 0.0
    max_tokens: int = 256
    timeout: float = 60
    rubric: str = RUBRIC
    reasoning_effort: str | None = None


def local_ollama(model_name: str, api_base: str) -> str:
    """Normalize the provider prefix and require a loopback Ollama endpoint."""
    if "/" not in model_name:
        model_name = "ollama_chat/" + model_name
    if not model_name.startswith(("ollama_chat/", "ollama/")):
        raise ValueError(
            "Use an ollama_chat/<model> or ollama/<model> model identifier"
        )
    if urlparse(api_base).hostname not in {"localhost", "127.0.0.1", "::1"}:
        raise ValueError("These experiments use a local Ollama endpoint")
    return model_name


def _decision(content: str | None) -> bool:
    if content is None:
        raise ValueError("Model returned no JSON content")
    parsed = json.loads(content)
    if (
        not isinstance(parsed, dict)
        or set(parsed) != {"productive", "reason"}
        or not isinstance(parsed["productive"], bool)
        or not isinstance(parsed["reason"], str)
    ):
        raise ValueError("Expected JSON with boolean productive and string reason")
    return parsed["productive"]


class ZeroShotClassifier(BaseClassifier):
    """Classify comments with one rendered instruction and no training examples."""

    def __init__(self, *, seed: int = 42, **settings: Any) -> None:
        super().__init__(seed=seed)
        self.settings = OllamaSettings(**settings)
        self.settings.model_name = local_ollama(
            self.settings.model_name, self.settings.api_base
        )
        env = Environment(
            loader=FileSystemLoader(Path(__file__).resolve().parents[1] / "templates"),
            undefined=StrictUndefined,
        )
        self.prompt = env.get_template("classify.j2").render(
            rubric=self.settings.rubric
        )
        self.metadata.update(
            self.settings.model_dump(),
            seed=seed,
            rubric_version=(
                RUBRIC_VERSION if self.settings.rubric == RUBRIC else "custom"
            ),
            score_semantics="No probability score is inferred from generated text",
        )

    def predict_one(self, text: str) -> dict[str, Any]:
        """Request one non-streaming JSON decision and preserve its provider payload."""
        import litellm

        options = self.settings
        extra: dict[str, Any] = (
            {"reasoning_effort": options.reasoning_effort}
            if options.reasoning_effort is not None
            else {}
        )
        # LiteLLM's response shape depends on the provider and has
        # incomplete usage stubs.
        response = cast(
            Any,
            litellm.completion(
                model=options.model_name,
                api_base=options.api_base,
                messages=[
                    {"role": "system", "content": self.prompt},
                    {"role": "user", "content": text},
                ],
                response_format={"type": "json_object"},
                temperature=options.temperature,
                max_tokens=options.max_tokens,
                seed=self.seed,
                timeout=options.timeout,
                num_retries=0,
                stream=False,
                **extra,
            ),
        )
        self.last_raw = response.model_dump(mode="json")
        return {
            "productive": _decision(response.choices[0].message.content),
            "score": None,
            "input_tokens": getattr(response.usage, "prompt_tokens", None),
            "output_tokens": getattr(response.usage, "completion_tokens", None),
            "raw": self.last_raw,
        }

    def save(self, directory: Path) -> None:
        """Save the exact rendered system prompt alongside responses and metadata."""
        super().save(directory)
        (directory / "system_prompt.txt").write_text(
            self.prompt + "\n", encoding="utf-8"
        )
