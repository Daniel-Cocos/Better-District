"""The Reports gallery: every photo residents sent in, tagged by category, with the
self-hosted model's estimate of how severe each problem is.

Photos can also be added by hand: anything dropped into report_photos/<category>/ next to
the database is imported as a report in that category the next time the gallery loads.
Severity runs in a background thread (one per database), like the Insights page, because a
vision model takes a while per photo. Results are stored in issue_analyses.
"""

import base64
import io
import json
import re
import sqlite3
import threading
from pathlib import Path
from typing import get_args

from PIL import Image, UnidentifiedImageError

from app import feedback
from app.database import connect
from app.insights import MAX_CONSECUTIVE_FAILURES, Job
from app.models import IssueCategory
from app.routes.issues import ISSUE_SQL, MAX_PHOTO_BYTES, normalize_photo

CATEGORIES: tuple[str, ...] = get_args(IssueCategory)
CATEGORY_LABELS = {"pothole": "Pothole", "graffiti": "Graffiti", "other": "Other"}
# Folder imports without GPS in the photo are pinned to the city centre
SOUTHAMPTON = (50.9097, -1.4044)
FOLDER_DESCRIPTION = "Added by the council from the report photo folder."

# Bump when the prompt changes, so every report is reassessed
SEVERITY_VERSION = "severity-1"
# Smaller photos are much faster on a local vision model and still show the problem
MODEL_PHOTO_SIZE = 1024

SEVERITY_PROMPT = """You assess reports residents send to Southampton City Council about
problems in public spaces, such as potholes, graffiti or other damage. Using the photo (if
given), the category and the resident's words, rate how severe the problem is:
- 3: dangerous or urgent. A risk to people, vehicles or property, or very large or offensive;
  the council should act within days. E.g. a deep pothole in a busy road, hate speech graffiti.
- 2: a clear problem that should be scheduled soon but is not an immediate danger.
- 1: minor or cosmetic. E.g. a shallow surface crack, a small tag on a wall.
Give "severity" (1, 2 or 3) and "reason": one short sentence on what you see that sets the
severity. Be factual. Answer with JSON only."""

SEVERITY_SCHEMA = {
    "type": "object",
    "properties": {
        "severity": {"type": "integer", "enum": [1, 2, 3]},
        "reason": {"type": "string"},
    },
    "required": ["severity", "reason"],
}


# ---------- The photo folder ----------


def photo_folder(path: Path) -> Path:
    """report_photos/ beside the database, e.g. backend/data/report_photos."""
    return path.parent / "report_photos"


def _title(filename: str) -> str:
    """ "big-pothole_on_high-st.jpg" -> "Big pothole on high st"."""
    words = " ".join(re.split(r"[\s_\-.]+", Path(filename).stem)).strip()
    return (words[:1].upper() + words[1:])[:200] or "Photo from the council folder"


def _degrees(dms, ref) -> float:
    degrees, minutes, seconds = (float(value) for value in dms)
    value = degrees + minutes / 60 + seconds / 3600
    return -value if ref in ("S", "W") else value


def photo_location(data: bytes) -> tuple[float, float] | None:
    """Where the photo was taken, from its EXIF GPS, if the camera recorded it."""
    try:
        with Image.open(io.BytesIO(data)) as image:
            gps = image.getexif().get_ifd(0x8825)
        latitude = _degrees(gps[2], gps.get(1))
        longitude = _degrees(gps[4], gps.get(3))
    except (
        UnidentifiedImageError,
        OSError,
        KeyError,
        TypeError,
        ValueError,
        ZeroDivisionError,
        Image.DecompressionBombError,
    ):
        return None
    if not (-90 <= latitude <= 90 and -180 <= longitude <= 180):
        return None
    if latitude == 0 and longitude == 0:
        return None  # an unset GPS block, not a photo from the Gulf of Guinea
    return latitude, longitude


_import_lock = threading.Lock()


def import_folder(database: sqlite3.Connection, folder: Path) -> list[str]:
    """Add every new photo in the folder as a report in its subfolder's category.
    Returns the files that couldn't be read as photos. Each file is imported once."""
    skipped = []
    with _import_lock:
        for category in CATEGORIES:
            (folder / category).mkdir(parents=True, exist_ok=True)
            for file in sorted((folder / category).iterdir()):
                if not file.is_file() or file.name.startswith("."):
                    continue
                key = f"folder:{category}/{file.name}"
                if database.execute(
                    "SELECT 1 FROM community_issues WHERE owner_key = ?", (key,)
                ).fetchone():
                    continue
                name = f"{category}/{file.name}"
                if file.stat().st_size > MAX_PHOTO_BYTES:
                    skipped.append(name)
                    continue
                data = file.read_bytes()
                try:
                    photo = normalize_photo(data)
                except ValueError:
                    skipped.append(name)
                    continue
                latitude, longitude = photo_location(data) or SOUTHAMPTON
                issue_id = database.execute(
                    "INSERT INTO community_issues "
                    "(title, description, latitude, longitude, owner_key, category) "
                    "VALUES (?, ?, ?, ?, ?, ?)",
                    (
                        _title(file.name),
                        FOLDER_DESCRIPTION,
                        latitude,
                        longitude,
                        key,
                        category,
                    ),
                ).lastrowid
                database.execute(
                    "INSERT INTO issue_photos (issue_id, content_type, size, data) "
                    "VALUES (?, 'image/jpeg', ?, ?)",
                    (issue_id, len(photo), photo),
                )
        # Commit while still holding the lock, so a second request can't import a file twice
        database.commit()
    return skipped


# ---------- Severity ----------


def severities(database: sqlite3.Connection) -> dict[int, dict]:
    """The current severity of every assessed report."""
    return {
        row["issue_id"]: {
            **json.loads(row["result_json"]),
            "generated_at": row["created_at"],
        }
        for row in database.execute(
            "SELECT issue_id, result_json, created_at FROM issue_analyses "
            "WHERE model_version = ? ORDER BY id",
            (SEVERITY_VERSION,),
        )
    }


def _model_photo(photo: bytes) -> str:
    with Image.open(io.BytesIO(photo)) as image:
        image.thumbnail((MODEL_PHOTO_SIZE, MODEL_PHOTO_SIZE))
        output = io.BytesIO()
        image.convert("RGB").save(output, format="JPEG", quality=80)
    return base64.b64encode(output.getvalue()).decode()


def assess(issue: dict, photo: bytes | None, model: str, vision: bool) -> dict:
    """Ask the model how severe one report is."""
    prompt = (
        f"Category: {CATEGORY_LABELS[issue['category']]}\n"
        f"Title: {issue['title']}\n"
        f"Description: {issue['description'][:2000]}"
    )
    images = [_model_photo(photo)] if vision and photo else None
    result = feedback.ask_model(
        model,
        prompt,
        SEVERITY_PROMPT,
        SEVERITY_SCHEMA,
        images=images,
        num_ctx=8192,
    )
    level = result.get("severity")
    if level not in (1, 2, 3):
        raise feedback.AnalysisUnavailable("The model didn’t give a severity")
    return {
        "level": level,
        "reason": " ".join(str(result.get("reason") or "").split())[:400],
        "model": model,
        "saw_photo": bool(images),
    }


def assess_issue(database: sqlite3.Connection, issue_id: int, model: str, vision: bool):
    """Assess one report and store the result. LookupError if it's gone."""
    row = database.execute(f"{ISSUE_SQL} WHERE id = ?", (issue_id,)).fetchone()
    if row is None:
        raise LookupError(issue_id)
    photo = database.execute(
        "SELECT data FROM issue_photos WHERE issue_id = ?", (issue_id,)
    ).fetchone()
    result = assess(dict(row), photo["data"] if photo else None, model, vision)
    database.execute(
        "DELETE FROM issue_analyses WHERE issue_id = ? AND model_version = ?",
        (issue_id, SEVERITY_VERSION),
    )
    database.execute(
        "INSERT INTO issue_analyses (issue_id, model_version, result_json) VALUES (?, ?, ?)",
        (issue_id, SEVERITY_VERSION, json.dumps(result)),
    )


# ---------- The page and its background job ----------

_jobs: dict[Path, Job] = {}
_jobs_lock = threading.Lock()


def job_for(path: Path) -> Job:
    """One job per database file, shared by every request."""
    with _jobs_lock:
        return _jobs.setdefault(path, Job())


def reports(database: sqlite3.Connection, path: Path) -> dict:
    """Everything the gallery shows, after picking up new photos in the folder.
    Never calls the model."""
    folder = photo_folder(path)
    skipped = import_folder(database, folder)
    assessed = severities(database)
    rows = [
        {**dict(row), "severity": assessed.get(row["id"])}
        for row in database.execute(f"{ISSUE_SQL} ORDER BY id DESC")
    ]
    return {
        "reports": rows,
        "job": job_for(path).snapshot(),
        "pending": sum(1 for r in rows if r["severity"] is None),
        "folder": str(folder.resolve()),
        "skipped": skipped,
    }


def start(path: Path, force: bool = False, background: bool = True) -> bool:
    """Start assessing every report without a severity (or all of them with `force`).
    Returns False if a run is already going."""
    job = job_for(path)
    with job.lock:
        if job.state["running"]:
            return False
        job.state.update(
            running=True, done=0, total=0, current=None, error=None, failed=0
        )
    if background:
        threading.Thread(target=run, args=(path, force), daemon=True).start()
    else:
        run(path, force)
    return True


def run(path: Path, force: bool = False):
    """The job itself. Uses short connections so it never holds the database between
    model calls."""
    job = job_for(path)
    try:
        with connect(path) as database:
            assessed = severities(database)
            todo = [
                (row["id"], row["title"])
                for row in database.execute(
                    "SELECT id, title FROM community_issues ORDER BY id DESC"
                )
                if force or row["id"] not in assessed
            ]
        job.update(total=len(todo))
        if not todo:
            return
        job.update(current="Choosing a model")
        model, vision = feedback.pick_vision_model()
        failures = 0
        for issue_id, title in todo:
            job.update(current=title)
            try:
                with connect(path) as database:
                    assess_issue(database, issue_id, model, vision)
                failures = 0
            except LookupError:
                pass  # deleted while we worked
            except feedback.AnalysisUnavailable as error:
                failures += 1
                job.update(failed=job.snapshot()["failed"] + 1, error=str(error))
                if failures >= MAX_CONSECUTIVE_FAILURES:
                    return
            job.update(done=job.snapshot()["done"] + 1)
    except feedback.AnalysisUnavailable as error:
        job.update(error=str(error))
    except Exception as error:  # pylint: disable=broad-exception-caught
        # A background thread has nobody to raise to; show it on the page instead
        job.update(error=f"The severity run stopped unexpectedly: {error}")
    finally:
        job.update(running=False, current=None)
