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
