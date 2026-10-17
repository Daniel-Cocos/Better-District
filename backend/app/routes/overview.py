"""Dashboard numbers for the admin website's overview page."""

import json
from fastapi import APIRouter
from app.database import Database
from app.models import Overview
from app.routes.projects import list_draft_summaries
from app.security import CurrentAdmin

router = APIRouter(prefix="/admin", tags=["admin overview"])


def _engagement(row) -> list[str]:
    """Summarise how residents can respond, from a project's settings and questions."""
    if row["stage"] is None:  # posted outside the admin site: plain comments
        return ["comments"]
    types = json.loads(row["question_types"] or "[]")
    modes = []
    if row["custom_comments"]:
        modes.append("comments")
    if row["comment_replies"]:
        modes.append("threads")
    if {"single_choice", "multiple_choice"} & set(types):
        modes.append("poll")
    if row["default_questions"] or {"short_text", "rating"} & set(types):
        modes.append("survey")
    return modes


@router.get("/overview", response_model=Overview)
def overview(database: Database, _admin: CurrentAdmin):
    rows = database.execute("""
        SELECT e.*, p.stage, p.ward, p.radius_m, p.feedback_closes, p.updated_at,
               p.custom_comments, p.comment_replies, p.default_questions,
               (SELECT count(*) FROM comments c WHERE c.event_id = e.id) AS comment_count,
               (SELECT json_group_array(q.type) FROM project_questions q
                WHERE q.event_id = e.id) AS question_types
        FROM events e LEFT JOIN projects p ON p.event_id = e.id
        ORDER BY coalesce(p.updated_at, '') DESC, e.id DESC
        """).fetchall()
    posts = [
        {
            "id": row["id"],
            "title": row["title"],
            "ward": row["ward"],
            "location": {
                "latitude": row["latitude"],
                "longitude": row["longitude"],
                "radius_m": row["radius_m"] or 100,
            },
            "stage": row["stage"] or "proposal",
            "engagement": _engagement(row),
            "responses": row["comment_count"] + row["likes"] + row["dislikes"],
            "closes_on": row["feedback_closes"],
            "updated_at": row["updated_at"],
        }
        for row in rows
    ]
    drafts = list_draft_summaries(database)
    stages = [post["stage"] for post in posts]
    return {
        "stats": {
            "open_consultations": stages.count("proposal"),
            "live_trials": stages.count("live_trial"),
            "completed": stages.count("built"),
            "drafts": len(drafts),
            "comments": sum(row["comment_count"] for row in rows),
            "reactions": sum(row["likes"] + row["dislikes"] for row in rows),
        },
        "posts": posts,
        "recent_comments": [
            dict(row)
            for row in database.execute(
                "SELECT c.id, c.event_id, e.title AS event_title, c.body, c.user_email "
                "FROM comments c JOIN events e ON e.id = c.event_id "
                "ORDER BY c.id DESC LIMIT 8"
            )
        ],
        "drafts": drafts,
    }
