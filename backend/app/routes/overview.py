"""Dashboard numbers for the admin website's overview page, all from app data."""

from datetime import datetime, timezone
from fastapi import APIRouter
from app.database import Database
from app.models import Overview
from app.security import CurrentAdmin

router = APIRouter(prefix="/admin", tags=["admin overview"])


@router.get("/overview", response_model=Overview)
def overview(database: Database, _admin: CurrentAdmin):
    now = datetime.now(timezone.utc).isoformat()
    events = database.execute(
        "SELECT count(*) AS events, coalesce(sum(likes), 0) AS likes, "
        "coalesce(sum(dislikes), 0) AS dislikes, "
        # Deadlines are stored as UTC ISO strings, so text order is time order
        "coalesce(sum(closes_at IS NULL OR closes_at > ?), 0) AS open_events FROM events",
        (now,),
    ).fetchone()
    return {
        "stats": {
            **dict(events),
            "comments": database.execute("SELECT count(*) FROM comments").fetchone()[0],
            "flagged_comments": database.execute(
                "SELECT count(*) FROM comments WHERE status = 'flagged'"
            ).fetchone()[0],
            "residents": database.execute(
                "SELECT count(*) FROM users "
                "WHERE email NOT IN (SELECT email FROM admins)"
            ).fetchone()[0],
        },
        "recent_comments": [
            {**dict(row), "under_review": row["status"] == "flagged"}
            for row in database.execute(
                "SELECT c.id, c.event_id, e.title AS event_title, c.body, c.user_email, "
                "c.likes, c.dislikes, c.status "
                "FROM comments c JOIN events e ON e.id = c.event_id "
                "ORDER BY c.id DESC LIMIT 10"
            )
        ],
    }
