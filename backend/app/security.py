"""Password hashing, optional HTTP Basic authentication, and admin sessions."""

from datetime import datetime, timedelta, timezone
import hashlib
import secrets
import sqlite3
from typing import Annotated
from fastapi import Depends, HTTPException
from fastapi.security import (
    HTTPAuthorizationCredentials,
    HTTPBasic,
    HTTPBasicCredentials,
    HTTPBearer,
)
from app.database import Database
from app.models import Admin

basic = HTTPBasic(auto_error=False)
Credentials = Annotated[HTTPBasicCredentials | None, Depends(basic)]


def hash_password(password: str) -> str:
    """Hash a password with scrypt and a fresh random salt."""
    salt = secrets.token_hex(16)
    digest = hashlib.scrypt(
        password.encode(), salt=bytes.fromhex(salt), n=16384, r=8, p=1
    )
    return f"scrypt${salt}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    """Compare a supplied password to its stored hash."""
    algorithm, salt, expected = stored.split("$")
    if algorithm != "scrypt":
        return False
    digest = hashlib.scrypt(
        password.encode(), salt=bytes.fromhex(salt), n=16384, r=8, p=1
    )
    return secrets.compare_digest(digest.hex(), expected)


DUMMY_HASH = hash_password("unknown-user-password")


def unauthorized():
    """Return the standard Basic authentication challenge."""
    return HTTPException(
        status_code=401,
        detail="Invalid or missing credentials",
        headers={"WWW-Authenticate": "Basic"},
    )


def optional_user(database: Database, credentials: Credentials) -> str | None:
    """Anonymous requests are allowed; supplied credentials must be valid."""
    if credentials is None:
        return None
    row = database.execute(
        "SELECT * FROM users WHERE email = ?", (credentials.username.strip().lower(),)
    ).fetchone()
    stored = row["password_hash"] if row else DUMMY_HASH
    valid = verify_password(credentials.password, stored)
    if row is None or not valid:
        raise unauthorized()
    return row["email"]


OptionalUser = Annotated[str | None, Depends(optional_user)]


# ---------- Admin website sessions ----------

SESSION_LENGTH = timedelta(hours=8)
bearer = HTTPBearer(auto_error=False)
BearerToken = Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)]


def _token_hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def authenticate_admin(
    database: sqlite3.Connection, email: str, password: str
) -> Admin | None:
    """Check an admin's password; non-admin users are refused like wrong passwords."""
    row = database.execute(
        "SELECT a.email, a.name, a.job_title, u.password_hash FROM admins a "
        "JOIN users u ON u.email = a.email WHERE a.email = ?",
        (email.strip().lower(),),
    ).fetchone()
    valid = verify_password(password, row["password_hash"] if row else DUMMY_HASH)
    if row is None or not valid:
        return None
    return Admin(email=row["email"], name=row["name"], job_title=row["job_title"])


def start_admin_session(database: sqlite3.Connection, admin: Admin) -> str:
    """Issue a bearer token and clear out expired ones."""
    token = secrets.token_urlsafe(32)
    database.execute("DELETE FROM admin_sessions WHERE expires_at < ?", (_now(),))
    database.execute(
        "INSERT INTO admin_sessions (token_hash, email, expires_at) VALUES (?, ?, ?)",
        (
            _token_hash(token),
            admin.email,
            (datetime.now(timezone.utc) + SESSION_LENGTH).isoformat(),
        ),
    )
    return token


def end_admin_session(database: sqlite3.Connection, token: str):
    """Revoke a bearer token."""
    database.execute(
        "DELETE FROM admin_sessions WHERE token_hash = ?", (_token_hash(token),)
    )


def require_admin(database: Database, credentials: BearerToken) -> Admin:
    """Admin endpoints need a live bearer token from POST /auth/login."""
    row = None
    if credentials is not None:
        row = database.execute(
            "SELECT a.email, a.name, a.job_title FROM admin_sessions s "
            "JOIN admins a ON a.email = s.email "
            "WHERE s.token_hash = ? AND s.expires_at > ?",
            (_token_hash(credentials.credentials), _now()),
        ).fetchone()
    if row is None:
        raise HTTPException(
            status_code=401,
            detail="Your session has expired. Please sign in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return Admin(**dict(row))


CurrentAdmin = Annotated[Admin, Depends(require_admin)]
