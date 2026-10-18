"""Retrying, atomic PDF downloads; valid cached PDFs support offline rebuilds."""

import os
from pathlib import Path
import tempfile
import time
from urllib.request import Request, urlopen

from .extract import validate_pdf
from .sources import Source


def download_source(source: Source, raw_dir: Path, *, force: bool = False) -> Path:
    """Reuse a validated cached PDF or retry an atomic source download."""
    raw_dir.mkdir(parents=True, exist_ok=True)
    target = raw_dir / source.filename
    if target.exists() and not force:
        try:
            validate_pdf(target)
            return target
        except ValueError, RuntimeError:
            pass  # An invalid cached response must be fetched again.
    for attempt in range(3):
        temporary = None
        try:
            request = Request(
                source.url, headers={"User-Agent": "CivicNLPResearch/2.0"}
            )
            with (
                urlopen(request, timeout=60) as response,
                tempfile.NamedTemporaryFile(
                    dir=raw_dir, suffix=".pdf", delete=False
                ) as handle,
            ):
                temporary = Path(handle.name)
                while chunk := response.read(1024 * 1024):
                    handle.write(chunk)
            validate_pdf(temporary)
            os.replace(temporary, target)
            return target
        except OSError, ValueError, RuntimeError:
            if attempt == 2:
                raise
            time.sleep(2**attempt)
        finally:
            if temporary is not None:
                temporary.unlink(missing_ok=True)
    raise AssertionError("unreachable")
