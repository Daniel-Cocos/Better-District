"""Change stream for the admin website, so its pages update as residents use the app."""

import asyncio
import json
import sqlite3
import time
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
from app.database import connect
from app.security import BearerToken, require_admin

router = APIRouter(prefix="/admin", tags=["admin live"])

POLL_SECONDS = 1.0
HEARTBEAT_SECONDS = 15.0
# Streams end after this long and the client reconnects, re-checking its session
STREAM_SECONDS = 300.0


def change_signature(database: sqlite3.Connection) -> str:
    """Bumped by triggers on every event, comment and vote change (see sql/schema.sql)."""
    return str(database.execute("SELECT value FROM revision").fetchone()[0])


def _message(version: str) -> str:
    return f"event: change\ndata: {json.dumps({'version': version})}\n\n"


@router.get("/stream")
async def stream(request: Request, credentials: BearerToken):
    """Server-sent events: one `change` now, then another whenever events, votes or comments change.

    Uses short-lived connections instead of the request-scoped Database, so an
    open stream never holds SQLite open for its whole lifetime.
    """
    path = request.app.state.database_path

    def check() -> str:
        with connect(path) as database:
            require_admin(database, credentials)
            return change_signature(database)

    first = await asyncio.to_thread(
        check
    )  # a bad token is a plain 401, before streaming

    async def events():
        last, quiet = first, 0.0
        deadline = time.monotonic() + STREAM_SECONDS
        yield _message(first)
        while time.monotonic() < deadline and not await request.is_disconnected():
            await asyncio.sleep(POLL_SECONDS)
            try:
                current = await asyncio.to_thread(check)
            except HTTPException:
                return  # session expired; the client reconnects, gets 401 and signs out
            if current != last:
                last, quiet = current, 0.0
                yield _message(current)
            else:
                quiet += POLL_SECONDS
                if quiet >= HEARTBEAT_SECONDS:
                    quiet = 0.0
                    yield ": keep-alive\n\n"  # stops proxies closing an idle stream

    return StreamingResponse(
        events(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
