"""A small FastAPI API backed by a local SQLite database."""

from contextlib import asynccontextmanager, closing, contextmanager
from pathlib import Path
import sqlite3
from typing import Annotated

from fastapi import FastAPI, HTTPException, Query, Response
from pydantic import BaseModel, Field


class ItemInput(BaseModel):
    name: str = Field(min_length=1, max_length=200, pattern=r"\S")
    description: str = Field(default="", max_length=2000)


class Item(ItemInput):
    id: int


def create_app(database_path: Path | None = None) -> FastAPI:
    """Create an app with an independently configurable database file."""
    db_path = database_path or Path(__file__).resolve().parents[1] / "data" / "app.db"

    @contextmanager
    def connect():
        connection = sqlite3.connect(db_path)
        connection.row_factory = sqlite3.Row
        with closing(connection):
            with connection:
                yield connection

    @asynccontextmanager
    async def lifespan(_app: FastAPI):
        db_path.parent.mkdir(parents=True, exist_ok=True)
        with connect() as connection:
            connection.execute(
                "CREATE TABLE IF NOT EXISTS items ("
                "id INTEGER PRIMARY KEY AUTOINCREMENT, "
                "name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '')"
            )
        yield

    application = FastAPI(title="Soton Ship API", lifespan=lifespan)

    @application.get("/health")
    def health():
        with connect() as connection:
            connection.execute("SELECT 1")
        return {"status": "ok"}

    @application.post("/items", response_model=Item, status_code=201)
    def create_item(item: ItemInput):
        with connect() as connection:
            cursor = connection.execute(
                "INSERT INTO items (name, description) VALUES (?, ?)",
                (item.name, item.description),
            )
            return {"id": cursor.lastrowid, **item.model_dump()}

    @application.get("/items", response_model=list[Item])
    def list_items(
        offset: Annotated[int, Query(ge=0)] = 0,
        limit: Annotated[int, Query(ge=1, le=100)] = 100,
    ):
        with connect() as connection:
            rows = connection.execute(
                "SELECT * FROM items ORDER BY id LIMIT ? OFFSET ?", (limit, offset)
            ).fetchall()
            return [dict(row) for row in rows]

    @application.get("/items/{item_id}", response_model=Item)
    def get_item(item_id: int):
        with connect() as connection:
            row = connection.execute(
                "SELECT * FROM items WHERE id = ?", (item_id,)
            ).fetchone()
            if row is None:
                raise HTTPException(status_code=404, detail="Item not found")
            return dict(row)

    @application.put("/items/{item_id}", response_model=Item)
    def update_item(item_id: int, item: ItemInput):
        with connect() as connection:
            cursor = connection.execute(
                "UPDATE items SET name = ?, description = ? WHERE id = ?",
                (item.name, item.description, item_id),
            )
            if cursor.rowcount == 0:
                raise HTTPException(status_code=404, detail="Item not found")
            return {"id": item_id, **item.model_dump()}

    @application.delete("/items/{item_id}", status_code=204)
    def delete_item(item_id: int):
        with connect() as connection:
            cursor = connection.execute("DELETE FROM items WHERE id = ?", (item_id,))
            if cursor.rowcount == 0:
                raise HTTPException(status_code=404, detail="Item not found")
        return Response(status_code=204)

    return application


app = create_app()
