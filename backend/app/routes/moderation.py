"""Admin moderation: add, edit and remove the events and comments residents see in the app."""

from fastapi import APIRouter, HTTPException, Response
from app.database import Database
from app.models import AdminEvent, EventCreate
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
