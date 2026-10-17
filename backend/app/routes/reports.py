"""The admin website's Reports page: residents' photos by category and severity."""

from fastapi import APIRouter, Request
from app import reports
from app.database import Database
from app.models import Reports
from app.security import CurrentAdmin

router = APIRouter(prefix="/admin/reports", tags=["admin reports"])


@router.get("", response_model=Reports)
def get_reports(request: Request, database: Database, _admin: CurrentAdmin):
    """Every report with its stored severity and the job's progress. Picks up photos
    dropped into the report photo folder first. Fast; never waits for the model."""
    return reports.reports(database, request.app.state.database_path)


@router.post("/assess", response_model=Reports, status_code=202)
def assess_reports(
    request: Request, database: Database, _admin: CurrentAdmin, force: bool = False
):
    """Start estimating the severity of every report that hasn't got one. With `force`,
    every report is reassessed. Poll GET for progress."""
    path = request.app.state.database_path
    reports.start(path, force, background=request.app.state.background_jobs)
    return reports.reports(database, path)
