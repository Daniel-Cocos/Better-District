"""Admin moderation: add, edit and remove the events and comments residents see in the app."""

import json
from fastapi import APIRouter, HTTPException, Response
from app.database import Database
from app.models import AdminEvent, EventCreate, Comment, CommentCreate, FlaggedComment
from app.routes.comments import add_comment, event_comments
from app.routes.users import list_notifications, read_notification
from app.routes.events import event_values, insert_event
from app.security import CurrentAdmin

router = APIRouter(prefix="/admin", tags=["admin moderation"])

ADMIN_EVENT_SQL = (
    "SELECT e.*, (SELECT count(*) FROM comments c WHERE c.event_id = e.id) AS comments "
    "FROM events e"
)


def require_admin_event(database: Database, event_id: int) -> dict:
    """Fetch an event with its comment count, or return a consistent 404."""
    row = database.execute(f"{ADMIN_EVENT_SQL} WHERE e.id = ?", (event_id,)).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Event not found")
    return dict(row)


@router.get("/events", response_model=list[AdminEvent])
def list_admin_events(database: Database, _admin: CurrentAdmin):
    """Every event the app shows, in the app's order."""
    return [dict(row) for row in database.execute(f"{ADMIN_EVENT_SQL} ORDER BY e.id")]


@router.post("/events", response_model=AdminEvent, status_code=201)
def create_event(event: EventCreate, database: Database, _admin: CurrentAdmin):
    """Publish an event; the app picks it up on its next change check."""
    return require_admin_event(database, insert_event(database, event))


@router.put("/events/{event_id}", response_model=AdminEvent)
def update_event(
    event_id: int, event: EventCreate, database: Database, _admin: CurrentAdmin
):
    """Change an event's text, place or deadline; its votes and comments stay."""
    require_admin_event(database, event_id)
    database.execute(
        "UPDATE events SET title = ?, description = ?, latitude = ?, longitude = ?, "
        "closes_at = ? WHERE id = ?",
        (*event_values(event), event_id),
    )
    return require_admin_event(database, event_id)


@router.delete("/events/{event_id}", status_code=204)
def delete_event(event_id: int, database: Database, _admin: CurrentAdmin):
    """Remove an event with its comments and votes (they cascade)."""
    require_admin_event(database, event_id)
    database.execute("DELETE FROM events WHERE id = ?", (event_id,))
    return Response(status_code=204)


@router.delete("/comments/{comment_id}", status_code=204)
def delete_any_comment(comment_id: int, database: Database, _admin: CurrentAdmin):
    """Remove any resident's comment, e.g. one that breaks the rules."""
    if (
        database.execute("DELETE FROM comments WHERE id = ?", (comment_id,)).rowcount
        == 0
    ):
        raise HTTPException(status_code=404, detail="Comment not found")
    return Response(status_code=204)


@router.get("/flagged-comments", response_model=list[FlaggedComment])
def list_flagged_comments(database: Database, _admin: CurrentAdmin):
    """Comments residents reported, oldest report first, waiting for a decision."""
    rows = database.execute(
        "SELECT c.id, c.event_id, e.title AS event_title, c.body, c.user_email, "
        "c.likes, c.dislikes, c.parent_id, count(f.reporter) AS flags, "
        "json_group_array(f.reason) AS reasons, min(f.created_at) AS first_flagged_at "
        "FROM comments c JOIN events e ON e.id = c.event_id "
        "JOIN comment_flags f ON f.comment_id = c.id "
        "WHERE c.status = 'flagged' GROUP BY c.id ORDER BY first_flagged_at, c.id"
    )
    return [
        {
            **dict(row),
            "under_review": True,
            "reasons": [reason for reason in json.loads(row["reasons"]) if reason],
        }
        for row in rows
    ]


@router.post("/comments/{comment_id}/approve", status_code=204)
def approve_comment(comment_id: int, database: Database, _admin: CurrentAdmin):
    """Keep a reported comment: it returns to the app and can't be flagged again
    unless its author edits it. Rejecting a comment is DELETE /admin/comments/{id}."""
    if (
        database.execute(
            "UPDATE comments SET status = 'approved' WHERE id = ?", (comment_id,)
        ).rowcount
        == 0
    ):
        raise HTTPException(status_code=404, detail="Comment not found")
    database.execute("DELETE FROM comment_flags WHERE comment_id = ?", (comment_id,))
    return Response(status_code=204)


@router.get("/events/{event_id}/comments", response_model=list[Comment])
def admin_comments(event_id: int, database: Database, admin: CurrentAdmin):
    """Every comment on the event, including ones hidden while under review."""
    return event_comments(database, event_id, f"user:{admin.email}", True)


@router.post("/events/{event_id}/comments", response_model=Comment, status_code=201)
def admin_add_comment(
    event_id: int, comment: CommentCreate, database: Database, admin: CurrentAdmin
):
    return add_comment(event_id, comment, database, admin.email, f"user:{admin.email}")


@router.get("/notifications")
def admin_notifications(database: Database, admin: CurrentAdmin):
    return list_notifications(database, f"user:{admin.email}")


@router.patch("/notifications/{notification_id}/read")
def admin_read_notification(
    notification_id: int, database: Database, admin: CurrentAdmin
):
    return read_notification(notification_id, database, f"user:{admin.email}")
