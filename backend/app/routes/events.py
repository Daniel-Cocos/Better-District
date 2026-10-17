"""Council event endpoints."""

from datetime import timezone
from fastapi import APIRouter, HTTPException
from app.database import Database
from app.models import ChangeVersion, Event, EventCreate, VoteCreate
from app.routes.live import change_signature
from app.voting import Voter, cast_vote, with_vote

router = APIRouter(prefix="/events", tags=["events"])


def require_event(database: Database, event_id: int):
    """Fetch an event or return a consistent 404."""
    row = database.execute("SELECT * FROM events WHERE id = ?", (event_id,)).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Event not found")
    return dict(row)


def event_values(event: EventCreate) -> tuple:
    """Columns for INSERT or UPDATE, with the deadline stored in UTC."""
    return (
        event.title,
        event.description,
        event.latitude,
        event.longitude,
        event.closes_at.astimezone(timezone.utc).isoformat(),
    )


def insert_event(database: Database, event: EventCreate) -> int:
    """Add an event and return its id."""
    cursor = database.execute(
        "INSERT INTO events (title, description, latitude, longitude, closes_at) "
        "VALUES (?, ?, ?, ?, ?)",
        event_values(event),
    )
    assert cursor.lastrowid is not None
    return cursor.lastrowid


@router.get("", response_model=list[Event])
def list_events(database: Database, voter: Voter):
    return [
        with_vote(database, "events", dict(row), voter)
        for row in database.execute("SELECT * FROM events ORDER BY id")
    ]


@router.get("/version", response_model=ChangeVersion)
def events_version(database: Database):
    """A cheap fingerprint the app polls; it changes whenever events, votes or comments do."""
    return {"version": change_signature(database)}


@router.post("", response_model=Event, status_code=201)
def add_event(event: EventCreate, database: Database):
    return require_event(database, insert_event(database, event))


@router.get("/{event_id}", response_model=Event)
def get_event(event_id: int, database: Database, voter: Voter):
    return with_vote(database, "events", require_event(database, event_id), voter)


@router.put("/{event_id}/vote", response_model=Event)
def vote_event(event_id: int, vote: VoteCreate, database: Database, voter: Voter):
    """Like (1), dislike (-1), or remove (0) the caller's vote."""
    return cast_vote(database, "events", event_id, voter, vote.vote)
