"""The Insights page: every plan's feedback side by side, and a city-wide briefing.

Analysing every plan on a local model takes minutes, so it runs in a background thread
(one per database) and the page polls its progress. Results land in the same caches the
per-event endpoints use, so nothing is analysed twice.
"""

import json
import sqlite3
import threading
from datetime import datetime, timezone
from pathlib import Path

from app import feedback
from app.database import connect

# Give up on a run after this many plans fail in a row (e.g. the model server went away)
MAX_CONSECUTIVE_FAILURES = 3


def _plans(database: sqlite3.Connection) -> list[dict]:
    """Every plan with its votes, visible comments and cached analysis."""
    now = datetime.now(timezone.utc).isoformat()
    plans = []
    for row in database.execute("SELECT * FROM events ORDER BY id"):
        event = dict(row)
        comments = feedback.visible_comments(database, event["id"])
        analysis = feedback.cached_analysis(database, event, comments)
        votes = event["likes"] + event["dislikes"]
        approval = event["likes"] / votes if votes else None
        fingerprint = None
        if analysis and not analysis["stale"]:
            fingerprint = feedback.fingerprint(event, comments)
        plans.append(
            {
                "id": event["id"],
                "title": event["title"],
                # Deadlines are stored as UTC ISO strings, so text order is time order
                "closes_at": event["closes_at"],
                "is_open": event["closes_at"] is None or event["closes_at"] > now,
                "likes": event["likes"],
                "dislikes": event["dislikes"],
                "votes": votes,
                "approval": approval,
                "comments": len(comments),
                "analysis": analysis,
                "fingerprint": fingerprint,  # set only when the analysis is current
                "attention": feedback.attention(approval, votes, analysis),
            }
        )
    return plans


def _needs_analysis(plan: dict) -> bool:
    return plan["comments"] > 0 and (
        plan["analysis"] is None or plan["analysis"]["stale"]
    )


def _briefing_inputs(plans: list[dict]) -> list[dict]:
    return [p for p in plans if p["fingerprint"]]


def _cached_briefing(database: sqlite3.Connection, plans: list[dict]) -> dict | None:
    row = database.execute("SELECT * FROM insight_briefings WHERE id = 1").fetchone()
    if row is None:
        return None
    inputs = _briefing_inputs(plans)
    return {
        **json.loads(row["result_json"]),
        "generated_at": row["created_at"],
        "stale": not inputs
        or row["fingerprint"] != feedback.briefing_fingerprint(inputs),
    }


def _totals(plans: list[dict]) -> dict:
    likes = sum(p["likes"] for p in plans)
    dislikes = sum(p["dislikes"] for p in plans)
    types: dict[str, dict[str, int]] = {}
    classified = 0
    for plan in plans:
        if not plan["fingerprint"]:
            continue  # only current analyses
        classified += plan["analysis"]["classified"]
        for item in plan["analysis"]["types"]:
            entry = types.setdefault(item["type"], {"count": 0, "likes": 0})
            entry["count"] += item["count"]
            entry["likes"] += item["likes"]
    return {
        "plans": len(plans),
        "analysed": sum(1 for p in plans if p["fingerprint"]),
        "likes": likes,
        "dislikes": dislikes,
        "approval": likes / (likes + dislikes) if likes + dislikes else None,
        "comments": sum(p["comments"] for p in plans),
        "classified": classified,
        "types": [
            {"type": kind, **types[kind]}
            for kind in feedback.COMMENT_TYPES
            if kind in types
        ],
        "high_attention": sum(1 for p in plans if p["attention"]["level"] == "high"),
        "medium_attention": sum(
            1 for p in plans if p["attention"]["level"] == "medium"
        ),
    }


class Job:
    """Progress of the background run that brings every analysis up to date."""

    def __init__(self):
        self.lock = threading.Lock()
        self.state = {
            "running": False,
            "done": 0,
            "total": 0,
            "current": None,
            "error": None,
            "failed": 0,
        }

    def snapshot(self) -> dict:
        with self.lock:
            return dict(self.state)

    def update(self, **changes):
        with self.lock:
            self.state.update(changes)


_jobs: dict[Path, Job] = {}
_jobs_lock = threading.Lock()


def job_for(path: Path) -> Job:
    """One job per database file, shared by every request."""
    with _jobs_lock:
        return _jobs.setdefault(path, Job())


def insights(database: sqlite3.Connection, path: Path) -> dict:
    """Everything the page shows. Never calls the model."""
    plans = _plans(database)
    return {
        "plans": plans,
        "totals": _totals(plans),
        "briefing": _cached_briefing(database, plans),
        "job": job_for(path).snapshot(),
        "pending": sum(1 for p in plans if _needs_analysis(p)),
    }


def start(path: Path, force: bool = False, background: bool = True) -> bool:
    """Start bringing analyses (and then the briefing) up to date. Returns False if a
    run is already going. `force` redoes current results too."""
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
    """The job itself: each plan that needs it, then the briefing. Uses its own short
    connections so it never holds the database between model calls."""
    job = job_for(path)
    try:
        with connect(path) as database:
            todo = [
                (p["id"], p["title"])
                for p in _plans(database)
                if p["comments"] > 0 and (force or _needs_analysis(p))
            ]
        job.update(total=len(todo) + 1)  # + the briefing
        failures = 0
        for event_id, title in todo:
            job.update(current=title)
            try:
                with connect(path) as database:
                    feedback.ensure_analysis(database, event_id, force)
                failures = 0
            except LookupError:
                pass  # deleted while we worked
            except feedback.AnalysisUnavailable as error:
                failures += 1
                job.update(failed=job.snapshot()["failed"] + 1, error=str(error))
                if failures >= MAX_CONSECUTIVE_FAILURES:
                    return
            job.update(done=job.snapshot()["done"] + 1)

        job.update(current="City-wide briefing")
        with connect(path) as database:
            plans = _plans(database)
            inputs = _briefing_inputs(plans)
            cached = _cached_briefing(database, plans)
        if inputs and (force or cached is None or cached["stale"]):
            try:
                result = feedback.write_briefing(inputs)
            except feedback.AnalysisUnavailable as error:
                job.update(error=str(error), failed=job.snapshot()["failed"] + 1)
                return
            with connect(path) as database:
                database.execute(
                    "INSERT INTO insight_briefings (id, fingerprint, result_json) "
                    "VALUES (1, ?, ?) ON CONFLICT (id) DO UPDATE SET "
                    "fingerprint = excluded.fingerprint, "
                    "result_json = excluded.result_json, created_at = CURRENT_TIMESTAMP",
                    (feedback.briefing_fingerprint(inputs), json.dumps(result)),
                )
        job.update(done=job.snapshot()["done"] + 1)
    except Exception as error:  # pylint: disable=broad-exception-caught
        # A background thread has nobody to raise to; show it on the page instead
        job.update(error=f"The analysis run stopped unexpectedly: {error}")
    finally:
        job.update(running=False, current=None)
