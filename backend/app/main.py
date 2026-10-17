"""FastAPI application setup."""

from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI
from app.database import DEFAULT_DATABASE, connect, initialize
from app.routes import (
    auth,
    comments,
    events,
    feedback,
    insights,
    live,
    issues,
    moderation,
    overview,
    projects,
    users,
)


def create_app(
    database_path: Path | None = None, background_jobs: bool = True
) -> FastAPI:
    """Create the API using a local SQLite file."""
    path = database_path or DEFAULT_DATABASE

    @asynccontextmanager
    async def lifespan(_app: FastAPI):
        initialize(path)
        yield

    application = FastAPI(title="Soton Ship API", lifespan=lifespan)
    application.state.database_path = path
    # Tests run long jobs inline so they can check the results straight away
    application.state.background_jobs = background_jobs
    application.include_router(issues.router)
    application.include_router(events.router)
    application.include_router(comments.router)
    application.include_router(users.router)
    application.include_router(auth.router)
    application.include_router(overview.router)
    application.include_router(projects.router)
    application.include_router(live.router)
    application.include_router(moderation.router)
    application.include_router(feedback.router)
    application.include_router(insights.router)

    @application.get("/health")
    def health():
        with connect(path) as connection:
            connection.execute("SELECT 1")
        return {"status": "ok"}

    return application


app = create_app()
