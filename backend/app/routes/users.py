"""User registration and authenticated profile endpoint."""

import sqlite3
from fastapi import APIRouter, HTTPException
from app.database import Database
from app.models import User, UserCreate
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
