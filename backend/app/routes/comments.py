"""Comments belonging to a council event."""

from fastapi import APIRouter
from app.database import Database
from app.models import Comment, CommentCreate
from app.routes.events import require_event
from app.security import OptionalUser

router = APIRouter(prefix="/events/{event_id}/comments", tags=["comments"])


@router.get("", response_model=list[Comment])
def list_comments(event_id: int, database: Database):
    require_event(database, event_id)
    return [
        dict(row)
        for row in database.execute(
            "SELECT * FROM comments WHERE event_id = ? ORDER BY id", (event_id,)
        )
    ]


@router.post("", response_model=Comment, status_code=201)
def add_comment(
    event_id: int, comment: CommentCreate, database: Database, user: OptionalUser
):
    require_event(database, event_id)
    cursor = database.execute(
        "INSERT INTO comments (event_id, body, user_email) VALUES (?, ?, ?)",
        (event_id, comment.body, user),
    )
    row = database.execute(
        "SELECT * FROM comments WHERE id = ?", (cursor.lastrowid,)
    ).fetchone()
    return dict(row)
