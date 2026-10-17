"""The admin website's Insights page: feedback across every plan, and where to pivot."""

from fastapi import APIRouter, Request
from app import insights
from app.database import Database
from app.models import Insights
from app.security import CurrentAdmin

router = APIRouter(prefix="/admin/insights", tags=["admin insights"])


@router.get("", response_model=Insights)
def get_insights(request: Request, database: Database, _admin: CurrentAdmin):
    """Votes, cached analyses, the briefing and the background job's progress. Fast."""
    return insights.insights(database, request.app.state.database_path)


@router.post("/refresh", response_model=Insights, status_code=202)
def refresh_insights(
    request: Request, database: Database, _admin: CurrentAdmin, force: bool = False
):
    """Start analysing every plan whose comments changed, then rewrite the briefing.
    With `force`, everything is redone. Poll GET for progress."""
    path = request.app.state.database_path
    insights.start(path, force, background=request.app.state.background_jobs)
    return insights.insights(database, path)
