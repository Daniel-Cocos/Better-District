"""Comments belonging to a council event."""

from fastapi import APIRouter, HTTPException, Response
from app.database import Database
from app.models import Comment, CommentCreate, VoteCreate
from app.routes.events import require_event
from app.security import OptionalUser
from app.voting import Voter, cast_vote, owns_comment, with_vote

router = APIRouter(prefix="/events/{event_id}/comments", tags=["comments"])


@router.get("", response_model=list[Comment])
def list_comments(event_id: int, database: Database, voter: Voter):
    require_event(database, event_id)
    return [
        with_vote(database, "comments", dict(row), voter)
        for row in database.execute(
            "SELECT * FROM comments WHERE event_id = ? ORDER BY id", (event_id,)
        )
    ]


@router.post("", response_model=Comment, status_code=201)
def add_comment(
    event_id: int,
    comment: CommentCreate,
    database: Database,
    user: OptionalUser,
    voter: Voter,
):
    require_event(database, event_id)
    parent = None
    if comment.parent_id is not None:
        parent = database.execute(
            "SELECT * FROM comments WHERE id = ? AND event_id = ?",
            (comment.parent_id, event_id),
        ).fetchone()
        if parent is None:
            raise HTTPException(
                status_code=404, detail="Reply target not found in this event"
            )
        project = database.execute(
            "SELECT comment_replies FROM projects WHERE event_id = ?", (event_id,)
        ).fetchone()
        if project is not None and not project["comment_replies"]:
            raise HTTPException(
                status_code=403, detail="Replies are disabled for this event"
            )
    cursor = database.execute(
        "INSERT INTO comments (event_id, body, user_email, owner_key, parent_id) VALUES (?, ?, ?, ?, ?)",
        (event_id, comment.body, user, voter, comment.parent_id),
    )
    if parent is not None and not owns_comment(dict(parent), voter):
        recipient = (
            f"user:{parent['user_email']}"
            if parent["user_email"]
            else parent["owner_key"]
        )
        if recipient:
            database.execute(
                "INSERT INTO notifications (recipient, comment_id) VALUES (?, ?)",
                (recipient, cursor.lastrowid),
            )
    row = database.execute(
        "SELECT * FROM comments WHERE id = ?", (cursor.lastrowid,)
    ).fetchone()
    return with_vote(database, "comments", dict(row), voter)


def require_owned_comment(
    database: Database, event_id: int, comment_id: int, voter: str
):
    """Reject missing comments and attempts to modify another person's comment."""
    row = database.execute(
        "SELECT * FROM comments WHERE event_id = ? AND id = ?", (event_id, comment_id)
    ).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Comment not found")
    if not owns_comment(dict(row), voter):
        raise HTTPException(
            status_code=403, detail="You can only change your own comments"
        )
    return row


@router.patch("/{comment_id}", response_model=Comment)
def edit_comment(
    event_id: int,
    comment_id: int,
    comment: CommentCreate,
    database: Database,
    voter: Voter,
):
    """Edit an owned comment without changing its votes or identity."""
    require_owned_comment(database, event_id, comment_id, voter)
    database.execute(
        "UPDATE comments SET body = ? WHERE id = ?", (comment.body, comment_id)
    )
    row = database.execute(
        "SELECT * FROM comments WHERE id = ?", (comment_id,)
    ).fetchone()
    return with_vote(database, "comments", dict(row), voter)


@router.delete("/{comment_id}", status_code=204)
def delete_comment(event_id: int, comment_id: int, database: Database, voter: Voter):
    """Delete an owned comment; its vote records cascade automatically."""
    require_owned_comment(database, event_id, comment_id, voter)
    database.execute("DELETE FROM comments WHERE id = ?", (comment_id,))
    return Response(status_code=204)


@router.put("/{comment_id}/vote", response_model=Comment)
def vote_comment(
    event_id: int, comment_id: int, vote: VoteCreate, database: Database, voter: Voter
):
    """Vote on a comment belonging to this event."""
    require_event(database, event_id)
    row = database.execute(
        "SELECT * FROM comments WHERE id = ? AND event_id = ?", (comment_id, event_id)
    ).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Comment not found")
    if owns_comment(dict(row), voter) and vote.vote != 0:
        raise HTTPException(
            status_code=403, detail="You cannot vote on your own comment"
        )
    return cast_vote(database, "comments", comment_id, voter, vote.vote)
