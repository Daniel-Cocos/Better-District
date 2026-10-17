"""User registration and authenticated profile endpoint."""

import sqlite3
from fastapi import APIRouter, HTTPException
from app.database import Database
from app.models import CommentHistory, User, UserCreate
from app.voting import Voter, with_vote
from app.security import OptionalUser, hash_password, unauthorized

router = APIRouter(prefix="/users", tags=["users"])


@router.post("", response_model=User, status_code=201)
def register_user(user: UserCreate, database: Database):
    try:
        database.execute(
            "INSERT INTO users (email, password_hash) VALUES (?, ?)",
            (user.email, hash_password(user.password)),
        )
    except sqlite3.IntegrityError as error:
        raise HTTPException(
            status_code=409, detail="Email already registered"
        ) from error
    return {"email": user.email}


@router.get("/me", response_model=User)
def get_current_user(user: OptionalUser):
    """Sign in with HTTP Basic credentials to retrieve your profile."""
    if user is None:
        raise unauthorized()
    return {"email": user}


@router.get("/me/comments", response_model=list[CommentHistory])
def comment_history(database: Database, voter: Voter):
    """List the current account or anonymous guest's comments, newest first."""
    if voter.startswith("user:"):
        where, value = "comments.user_email = ?", voter[5:]
    else:
        where, value = "comments.user_email IS NULL AND comments.owner_key = ?", voter
    rows = database.execute(
        "SELECT comments.*, events.title AS event_title FROM comments "
        f"JOIN events ON events.id = comments.event_id WHERE {where} ORDER BY comments.id DESC",
        (value,),
    ).fetchall()
    return [with_vote(database, "comments", dict(row), voter) for row in rows]


@router.get("/me/notifications")
def list_notifications(database: Database, voter: Voter):
    rows = database.execute(
        "SELECT n.id, n.created_at, n.is_read, c.id AS comment_id, c.parent_id, "
        "c.event_id, coalesce(c.body, 'Your issue has been submitted to the council.') AS body, "
        "c.user_email, coalesce(e.title, i.title) AS event_title, n.issue_id, "
        "CASE WHEN n.issue_id IS NOT NULL THEN 'issue_submitted' ELSE 'reply' END AS kind "
        "FROM notifications n LEFT JOIN comments c ON c.id = n.comment_id "
        "LEFT JOIN events e ON e.id = c.event_id "
        "LEFT JOIN community_issues i ON i.id = n.issue_id "
        # Replies under review stay hidden, like they are in the conversation
        "WHERE n.recipient = ? AND (c.id IS NULL OR c.status != 'flagged') "
        "ORDER BY n.id DESC",
        (voter,),
    ).fetchall()
    return [{**dict(row), "is_read": bool(row["is_read"])} for row in rows]


@router.patch("/me/notifications/{notification_id}/read")
def read_notification(notification_id: int, database: Database, voter: Voter):
    cursor = database.execute(
        "UPDATE notifications SET is_read = 1 WHERE id = ? AND recipient = ?",
        (notification_id, voter),
    )
    if cursor.rowcount == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"is_read": True}
