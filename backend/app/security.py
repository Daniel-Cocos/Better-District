"""Password hashing and optional HTTP Basic authentication."""

import hashlib
import secrets
from typing import Annotated
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from app.database import Database

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
