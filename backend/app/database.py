"""SQLite connections, schema setup, and request dependencies."""

from contextlib import closing, contextmanager
from pathlib import Path
import sqlite3
from typing import Annotated
from fastapi import Depends, Request

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


def get_database(request: Request):
    """Supply a connection scoped to the request."""
    with connect(request.app.state.database_path) as connection:
        yield connection


Database = Annotated[sqlite3.Connection, Depends(get_database)]
