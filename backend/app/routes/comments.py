"""Comments belonging to a council event."""

from fastapi import APIRouter, HTTPException, Response
from app.database import Database
from app.models import Comment, CommentCreate, CommentFlagCreate, VoteCreate
from app.routes.events import require_event
from app.security import OptionalUser
from app.voting import Voter, cast_vote, owns_comment, with_vote

router = APIRouter(prefix="/events/{event_id}/comments", tags=["comments"])


# Flagged comments stay off the app until an admin has reviewed them
SHOWN = "status != 'flagged'"


def event_comments(
    database: Database, event_id: int, voter: str, include_flagged: bool = False
) -> list[dict]:
    """An event's comments in posting order; admins also see ones under review."""
    require_event(database, event_id)
    shown = "" if include_flagged else f" AND {SHOWN}"
    return [
        with_vote(database, "comments", dict(row), voter)
        for row in database.execute(
            f"SELECT * FROM comments WHERE event_id = ?{shown} ORDER BY id",
            (event_id,),
        )
    ]


@router.get("", response_model=list[Comment])
def list_comments(event_id: int, database: Database, voter: Voter):
    return event_comments(database, event_id, voter)


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
            f"SELECT * FROM comments WHERE id = ? AND event_id = ? AND {SHOWN}",
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
    """Edit an owned comment without changing its votes or identity.

    New text hasn't been reviewed, so a comment an admin kept can be flagged again.
    """
    require_owned_comment(database, event_id, comment_id, voter)
    database.execute(
        "UPDATE comments SET body = ?, "
        "status = CASE status WHEN 'approved' THEN 'visible' ELSE status END "
        "WHERE id = ?",
        (comment.body, comment_id),
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
        f"SELECT * FROM comments WHERE id = ? AND event_id = ? AND {SHOWN}",
        (comment_id, event_id),
    ).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Comment not found")
    if owns_comment(dict(row), voter) and vote.vote != 0:
        raise HTTPException(
            status_code=403, detail="You cannot vote on your own comment"
        )
    return cast_vote(database, "comments", comment_id, voter, vote.vote)


@router.post("/{comment_id}/flag", status_code=204)
def flag_comment(
    event_id: int,
    comment_id: int,
    flag: CommentFlagCreate,
    database: Database,
    voter: Voter,
):
    """Report a comment as inappropriate; it leaves the app until an admin reviews it."""
    require_event(database, event_id)
    row = database.execute(
        "SELECT * FROM comments WHERE id = ? AND event_id = ?", (comment_id, event_id)
    ).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Comment not found")
    if owns_comment(dict(row), voter):
        raise HTTPException(
            status_code=403, detail="You cannot report your own comment"
        )
    if row["status"] == "approved":
        raise HTTPException(
            status_code=409,
            detail="The council has already reviewed this comment and kept it",
        )
    database.execute(
        "INSERT INTO comment_flags (comment_id, reporter, reason) VALUES (?, ?, ?) "
        "ON CONFLICT (comment_id, reporter) DO NOTHING",
        (comment_id, voter, flag.reason.strip()),
    )
    database.execute(
        "UPDATE comments SET status = 'flagged' WHERE id = ? AND status = 'visible'",
        (comment_id,),
    )
    # No explicit Response, so the guest cookie set by Voter reaches the client
