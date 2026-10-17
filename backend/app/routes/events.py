"""Council event endpoints."""

from fastapi import APIRouter, HTTPException
from app.database import Database
from app.models import Event, EventCreate

router = APIRouter(prefix="/events", tags=["events"])


def require_event(database: Database, event_id: int):
    """Fetch an event or return a consistent 404."""
    row = database.execute("SELECT * FROM events WHERE id = ?", (event_id,)).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Event not found")
    return dict(row)


@router.get("", response_model=list[Event])
def list_events(database: Database):
    return [dict(row) for row in database.execute("SELECT * FROM events ORDER BY id")]


@router.post("", response_model=Event, status_code=201)
def add_event(event: EventCreate, database: Database):
    cursor = database.execute(
        "INSERT INTO events (title, description, latitude, longitude) VALUES (?, ?, ?, ?)",
        (event.title, event.description, event.latitude, event.longitude),
    )
    assert cursor.lastrowid is not None
    return require_event(database, cursor.lastrowid)


@router.get("/{event_id}", response_model=Event)
def get_event(event_id: int, database: Database):
    return require_event(database, event_id)
