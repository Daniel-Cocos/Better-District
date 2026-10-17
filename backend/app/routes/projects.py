"""Admin project wizard: drafts, document uploads, and publishing."""

import json
from pathlib import Path
import secrets
import sqlite3
from fastapi import APIRouter, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse
from app.database import Database
from app.models import (
    Document,
    Draft,
    DraftSummary,
    Project,
    ProjectForm,
    PublishRequest,
)
from app.security import CurrentAdmin

router = APIRouter(prefix="/admin", tags=["admin projects"])

MAX_UPLOAD_BYTES = 20 * 1024 * 1024
ALLOWED_TYPES = {
    "application/pdf",
    "text/plain",
    "text/markdown",
    "image/png",
    "image/jpeg",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}


def upload_path(request: Request, document_id: str) -> Path:
    """Where an uploaded file's bytes live: an uploads folder beside the database."""
    return request.app.state.database_path.parent / "uploads" / document_id


def load_documents(database: sqlite3.Connection, ids: list[str]) -> list[Document]:
    """Fetch documents in the order given, failing if any are missing."""
    documents = []
    for document_id in ids:
        row = database.execute(
            "SELECT id, name, size, content_type FROM project_documents WHERE id = ?",
            (document_id,),
        ).fetchone()
        if row is None:
            raise HTTPException(
                status_code=422, detail="One of the attached documents no longer exists"
            )
        documents.append(Document(**dict(row)))
    return documents


# ---------- uploads ----------


@router.post("/uploads", response_model=Document, status_code=201)
async def upload_document(
    file: UploadFile, request: Request, database: Database, admin: CurrentAdmin
):
    content_type = file.content_type or "application/octet-stream"
    if content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=415, detail="Upload a PDF, Word, text or image file"
        )
    data = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Files must be 20 MB or smaller")
    document = Document(
        id=secrets.token_hex(12),
        name=Path(file.filename or "document").name[:200],
        size=len(data),
        content_type=content_type,
    )
    path = upload_path(request, document.id)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    database.execute(
        "INSERT INTO project_documents (id, name, size, content_type, uploaded_by) "
        "VALUES (?, ?, ?, ?, ?)",
        (document.id, document.name, document.size, content_type, admin.email),
    )
    return document


@router.get("/uploads/{document_id}")
def download_document(
    document_id: str, request: Request, database: Database, _admin: CurrentAdmin
):
    document = load_documents(database, [document_id])[0]
    return FileResponse(
        upload_path(request, document.id),
        media_type=document.content_type,
        filename=document.name,
    )


# ---------- drafts ----------


def _draft(database: sqlite3.Connection, row: sqlite3.Row) -> Draft:
    form = ProjectForm.model_validate_json(row["data"])
    placeholders = ",".join("?" * len(form.document_ids))
    found = {
        d["id"]: Document(**dict(d))
        for d in database.execute(
            "SELECT id, name, size, content_type FROM project_documents "
            f"WHERE id IN ({placeholders})",
            form.document_ids,
        )
    }
    # Quietly drop attachments that have since been removed
    form.document_ids = [i for i in form.document_ids if i in found]
    return Draft(
        id=row["id"],
        form=form,
        documents=[found[i] for i in form.document_ids],
        updated_at=row["updated_at"],
    )


def require_draft(database: sqlite3.Connection, draft_id: int) -> Draft:
    """Fetch a draft or return a consistent 404."""
    row = database.execute(
        "SELECT * FROM project_drafts WHERE id = ?", (draft_id,)
    ).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Draft not found")
    return _draft(database, row)


def list_draft_summaries(database: sqlite3.Connection) -> list[DraftSummary]:
    """Drafts, most recently edited first."""
    return [
        DraftSummary(
            id=row["id"],
            title=json.loads(row["data"]).get("title") or "Untitled project",
            updated_at=row["updated_at"],
        )
        for row in database.execute(
            "SELECT id, data, updated_at FROM project_drafts ORDER BY updated_at DESC"
        )
    ]


@router.get("/drafts", response_model=list[DraftSummary])
def list_drafts(database: Database, _admin: CurrentAdmin):
    return list_draft_summaries(database)


@router.post("/drafts", response_model=Draft, status_code=201)
def create_draft(form: ProjectForm, database: Database, admin: CurrentAdmin):
    load_documents(database, form.document_ids)
    cursor = database.execute(
        "INSERT INTO project_drafts (data, created_by) VALUES (?, ?)",
        (form.model_dump_json(), admin.email),
    )
    assert cursor.lastrowid is not None
    return require_draft(database, cursor.lastrowid)


@router.get("/drafts/{draft_id}", response_model=Draft)
def get_draft(draft_id: int, database: Database, _admin: CurrentAdmin):
    return require_draft(database, draft_id)


@router.put("/drafts/{draft_id}", response_model=Draft)
def update_draft(
    draft_id: int, form: ProjectForm, database: Database, _admin: CurrentAdmin
):
    require_draft(database, draft_id)
    load_documents(database, form.document_ids)
    database.execute(
        "UPDATE project_drafts SET data = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        (form.model_dump_json(), draft_id),
    )
    return require_draft(database, draft_id)


@router.delete("/drafts/{draft_id}", status_code=204)
def delete_draft(draft_id: int, database: Database, _admin: CurrentAdmin):
    require_draft(database, draft_id)
    database.execute("DELETE FROM project_drafts WHERE id = ?", (draft_id,))


# ---------- published projects ----------


def require_project(database: sqlite3.Connection, event_id: int) -> Project:
    """Reassemble a published project from its event and project tables."""
    row = database.execute(
        "SELECT e.title, e.description, e.latitude, e.longitude, p.* "
        "FROM events e JOIN projects p ON p.event_id = e.id WHERE e.id = ?",
        (event_id,),
    ).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Project not found")
    terms = database.execute(
        "SELECT kind, body FROM project_terms WHERE event_id = ? ORDER BY position",
        (event_id,),
    ).fetchall()
    documents = [
        Document(**dict(d))
        for d in database.execute(
            "SELECT id, name, size, content_type FROM project_documents "
            "WHERE event_id = ? ORDER BY created_at, id",
            (event_id,),
        )
    ]
    return Project(
        event_id=event_id,
        title=row["title"],
        stage=row["stage"],
        feedback_opens=row["feedback_opens"],
        feedback_closes=row["feedback_closes"],
        team=row["team"],
        contact=row["contact"],
        location={
            "latitude": row["latitude"],
            "longitude": row["longitude"],
            "radius_m": row["radius_m"],
        },
        ward=row["ward"],
        document_ids=[d.id for d in documents],
        documents=documents,
        summary=row["description"],
        commitments=row["commitments"],
        custom_fields=[
            dict(f)
            for f in database.execute(
                "SELECT label, value FROM project_fields WHERE event_id = ? ORDER BY position",
                (event_id,),
            )
        ],
        permanent=[t["body"] for t in terms if t["kind"] == "permanent"],
        changeable=[t["body"] for t in terms if t["kind"] == "changeable"],
        questions=[
            {**dict(q), "options": json.loads(q["options"])}
            for q in database.execute(
                "SELECT type, prompt, options, required FROM project_questions "
                "WHERE event_id = ? ORDER BY position",
                (event_id,),
            )
        ],
        engagement={
            "default_questions": row["default_questions"],
            "custom_comments": row["custom_comments"],
            "comment_replies": row["comment_replies"],
            "demographics": json.loads(row["demographics"]),
        },
        created_by=row["created_by"],
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


@router.post("/projects", response_model=Project, status_code=201)
def publish_project(body: PublishRequest, database: Database, admin: CurrentAdmin):
    """Publish a finished form as a public event, consuming its draft if given."""
    problems = body.publish_problems()
    if problems:
        raise HTTPException(status_code=422, detail=". ".join(problems) + ".")
    if body.draft_id is not None:
        require_draft(database, body.draft_id)
    load_documents(database, body.document_ids)
    assert body.location is not None

    event_id = database.execute(
        "INSERT INTO events (title, description, latitude, longitude) VALUES (?, ?, ?, ?)",
        (
            body.title.strip(),
            body.summary.strip(),
            body.location.latitude,
            body.location.longitude,
        ),
    ).lastrowid
    settings = body.engagement
    database.execute(
        "INSERT INTO projects (event_id, stage, feedback_opens, feedback_closes, team, "
        "contact, radius_m, ward, commitments, default_questions, custom_comments, "
        "comment_replies, demographics, created_by) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (
            event_id,
            body.stage,
            body.feedback_opens and body.feedback_opens.isoformat(),
            body.feedback_closes and body.feedback_closes.isoformat(),
            body.team.strip(),
            body.contact.strip(),
            body.location.radius_m,
            (body.ward or "").strip() or None,
            body.commitments.strip(),
            settings.default_questions,
            settings.custom_comments,
            settings.comment_replies,
            json.dumps(settings.demographics),
            admin.email,
        ),
    )
    database.executemany(
        "UPDATE project_documents SET event_id = ? WHERE id = ?",
        [(event_id, document_id) for document_id in body.document_ids],
    )
    database.executemany(
        "INSERT INTO project_fields (event_id, position, label, value) VALUES (?, ?, ?, ?)",
        [
            (event_id, i, f.label.strip(), f.value.strip())
            for i, f in enumerate(body.custom_fields)
            if f.label.strip()
        ],
    )
    database.executemany(
        "INSERT INTO project_terms (event_id, kind, position, body) VALUES (?, ?, ?, ?)",
        [
            (event_id, kind, i, text.strip())
            for kind, items in (
                ("permanent", body.permanent),
                ("changeable", body.changeable),
            )
            for i, text in enumerate(items)
            if text.strip()
        ],
    )
    database.executemany(
        "INSERT INTO project_questions (event_id, position, type, prompt, options, required) "
        "VALUES (?, ?, ?, ?, ?, ?)",
        [
            (
                event_id,
                i,
                q.type,
                q.prompt.strip(),
                json.dumps([o.strip() for o in q.options if o.strip()]),
                q.required,
            )
            for i, q in enumerate(body.questions)
        ],
    )
    if body.draft_id is not None:
        database.execute("DELETE FROM project_drafts WHERE id = ?", (body.draft_id,))
    assert event_id is not None
    return require_project(database, event_id)


@router.get("/projects/{event_id}", response_model=Project)
def get_project(event_id: int, database: Database, _admin: CurrentAdmin):
    return require_project(database, event_id)
