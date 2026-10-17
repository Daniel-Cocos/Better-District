"""FastAPI application setup."""

from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI
from app.database import DEFAULT_DATABASE, connect, initialize
from app.routes import comments, events, users


def create_app(database_path: Path | None = None) -> FastAPI:
    """Create the API using a local SQLite file."""
    path = database_path or DEFAULT_DATABASE

    @asynccontextmanager
    async def lifespan(_app: FastAPI):
        initialize(path)
        yield

    application = FastAPI(title="Soton Ship API", lifespan=lifespan)
    application.state.database_path = path
    application.include_router(events.router)
    application.include_router(comments.router)
    application.include_router(users.router)

    @application.get("/health")
    def health():
        with connect(path) as connection:
            connection.execute("SELECT 1")
        return {"status": "ok"}

    return application


app = create_app()
