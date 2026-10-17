"""SQLite connections, schema setup, and request dependencies."""

from contextlib import closing, contextmanager
from datetime import date
from pathlib import Path
import sqlite3
from typing import Annotated
from fastapi import Depends, Request
from app.deadlines import feedback_deadline

BACKEND_DIR = Path(__file__).resolve().parents[1]
DEFAULT_DATABASE = BACKEND_DIR / "data" / "app.db"


@contextmanager
def connect(path: Path):
    """Commit on success, roll back on failure, and always close the connection."""
    with closing(sqlite3.connect(path, check_same_thread=False)) as connection:
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys = ON")
        with connection:
            yield connection


def initialize(path: Path = DEFAULT_DATABASE):
    """Create missing tables without replacing existing data."""
    path.parent.mkdir(parents=True, exist_ok=True)
    with connect(path) as connection:
        connection.executescript((BACKEND_DIR / "sql" / "schema.sql").read_text())
        columns = {
            row["name"] for row in connection.execute("PRAGMA table_info(events)")
        }
        if "closes_at" not in columns:
            connection.execute("ALTER TABLE events ADD COLUMN closes_at TEXT")
        comment_columns = {
            row["name"] for row in connection.execute("PRAGMA table_info(comments)")
        }
        if "owner_key" not in comment_columns:
            connection.execute("ALTER TABLE comments ADD COLUMN owner_key TEXT")
        if "parent_id" not in comment_columns:
            connection.execute(
                "ALTER TABLE comments ADD COLUMN parent_id INTEGER REFERENCES comments(id) ON DELETE SET NULL"
            )
        if "status" not in comment_columns:
            connection.execute(
                "ALTER TABLE comments ADD COLUMN status TEXT NOT NULL DEFAULT 'visible' "
                "CHECK (status IN ('visible', 'flagged', 'approved'))"
            )
        notification_columns = {
            row["name"]
            for row in connection.execute("PRAGMA table_info(notifications)")
        }
        if "issue_id" not in notification_columns:
            connection.execute(
                "CREATE TABLE notifications_new (id INTEGER PRIMARY KEY AUTOINCREMENT, recipient TEXT NOT NULL, comment_id INTEGER REFERENCES comments(id) ON DELETE CASCADE, issue_id INTEGER REFERENCES community_issues(id) ON DELETE CASCADE, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, is_read INTEGER NOT NULL DEFAULT 0, CHECK ((comment_id IS NOT NULL) != (issue_id IS NOT NULL)))"
            )
            connection.execute(
                "INSERT INTO notifications_new (id, recipient, comment_id, created_at, is_read) SELECT id, recipient, comment_id, created_at, is_read FROM notifications"
            )
            connection.execute("DROP TABLE notifications")
            connection.execute("ALTER TABLE notifications_new RENAME TO notifications")
            connection.execute(
                "CREATE INDEX notifications_recipient ON notifications(recipient, id)"
            )
        # Projects published before the app read their deadline from events.closes_at
        connection.executemany(
            "UPDATE events SET closes_at = ? WHERE id = ?",
            [
                (
                    feedback_deadline(date.fromisoformat(row["feedback_closes"])),
                    row["id"],
                )
                for row in connection.execute(
                    "SELECT e.id, p.feedback_closes FROM events e "
                    "JOIN projects p ON p.event_id = e.id "
                    "WHERE e.closes_at IS NULL AND p.feedback_closes IS NOT NULL"
                )
            ],
        )


def get_database(request: Request):
    """Supply a connection scoped to the request."""
    with connect(request.app.state.database_path) as connection:
        yield connection


Database = Annotated[sqlite3.Connection, Depends(get_database)]
