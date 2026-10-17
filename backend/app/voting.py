"""Per-account or anonymous-cookie votes with atomic counter updates."""

from typing import Annotated, Literal
from uuid import UUID, uuid4
from fastapi import Depends, HTTPException, Request, Response
from app.database import Database
from app.security import OptionalUser

Target = Literal["events", "comments"]
TABLES = {
    "events": ("event_votes", "event_id"),
    "comments": ("comment_votes", "comment_id"),
}


def voter_identity(user: OptionalUser, request: Request, response: Response) -> str:
    """Accounts share votes across devices; guests use a persistent HTTP-only cookie."""
    if user is not None:
        return f"user:{user}"
    try:
        token = str(UUID(request.cookies.get("guest_voter", "")))
    except ValueError:
        token = str(uuid4())
        response.set_cookie(
            "guest_voter", token, max_age=31536000, httponly=True, samesite="lax"
        )
    return f"guest:{token}"


Voter = Annotated[str, Depends(voter_identity)]


def with_vote(database: Database, target: Target, row: dict, voter: str) -> dict:
    """Attach the caller's vote to an existing event or comment."""
    table, column = TABLES[target]
    vote = database.execute(
        f"SELECT vote FROM {table} WHERE {column} = ? AND voter = ?", (row["id"], voter)
    ).fetchone()
    result = {**row, "my_vote": vote["vote"] if vote else 0}
    if target == "comments":
        result["is_mine"] = owns_comment(row, voter)
        result["under_review"] = row.get("status") == "flagged"
    return result


def owns_comment(row: dict, voter: str) -> bool:
    """Use account ownership for old signed-in comments and cookie ownership for guests."""
    if voter.startswith("user:"):
        return row.get("user_email") == voter[5:]
    return row.get("user_email") is None and row.get("owner_key") == voter


def cast_vote(
    database: Database, target: Target, item_id: int, voter: str, vote: int
) -> dict:
    """Set, switch, or remove one vote, serializing concurrent counter updates."""
    table, column = TABLES[target]
    database.execute("BEGIN IMMEDIATE")
    row = database.execute(
        f"SELECT * FROM {target} WHERE id = ?", (item_id,)
    ).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Event or comment not found")
    previous = with_vote(database, target, dict(row), voter)["my_vote"]
    if vote == 0:
        database.execute(
            f"DELETE FROM {table} WHERE {column} = ? AND voter = ?", (item_id, voter)
        )
    else:
        database.execute(
            f"INSERT INTO {table} ({column}, voter, vote) VALUES (?, ?, ?) "
            f"ON CONFLICT({column}, voter) DO UPDATE SET vote = excluded.vote",
            (item_id, voter, vote),
        )
    database.execute(
        f"UPDATE {target} SET likes = likes + ?, dislikes = dislikes + ? WHERE id = ?",
        (
            int(vote == 1) - int(previous == 1),
            int(vote == -1) - int(previous == -1),
            item_id,
        ),
    )
    updated = database.execute(
        f"SELECT * FROM {target} WHERE id = ?", (item_id,)
    ).fetchone()
    return with_vote(database, target, dict(updated), voter)
