"""Per-event feedback summaries for the admin website: vote ratio plus comment analysis."""

import sqlite3
from fastapi import APIRouter, HTTPException
from app import feedback
from app.database import Database
from app.models import FeedbackSummary
from app.routes.events import require_event
from app.security import CurrentAdmin

router = APIRouter(prefix="/admin/events/{event_id}/feedback", tags=["admin feedback"])


def summary(database: sqlite3.Connection, event: dict) -> dict:
    """Live vote numbers plus the cached analysis, marked stale if comments changed."""
    comments = feedback.visible_comments(database, event["id"])
    votes = event["likes"] + event["dislikes"]
    return {
        "event_id": event["id"],
        "likes": event["likes"],
        "dislikes": event["dislikes"],
        "approval": event["likes"] / votes if votes else None,
        "comments": len(comments),
        "comment_likes": sum(c["likes"] for c in comments),
        "comment_dislikes": sum(c["dislikes"] for c in comments),
        "analysis": feedback.cached_analysis(database, event, comments),
    }


@router.get("", response_model=FeedbackSummary)
def get_feedback(event_id: int, database: Database, _admin: CurrentAdmin):
    """Fast: never calls the model, so pages can show numbers straight away."""
    return summary(database, require_event(database, event_id))


@router.post("/analyse", response_model=FeedbackSummary)
def analyse_feedback(
    event_id: int, database: Database, _admin: CurrentAdmin, force: bool = False
):
    """Analyse the comments on the Ollama server, unless the cached result is current.

    Can take a while on a local model; concurrent requests for one event share a run.
    """
    require_event(database, event_id)
    try:
        feedback.ensure_analysis(database, event_id, force)
    except feedback.AnalysisUnavailable as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    except LookupError as error:
        raise HTTPException(status_code=404, detail="Event not found") from error
    return summary(database, require_event(database, event_id))
