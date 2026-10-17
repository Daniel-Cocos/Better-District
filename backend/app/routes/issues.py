"""Community proposals with a confirmed map location and a stored photograph."""

import io
from typing import Annotated
from fastapi import APIRouter, Form, HTTPException, UploadFile, Response
from PIL import Image, ImageOps, UnidentifiedImageError
from app.database import Database
from app.models import CommunityIssue, IssueCategory, IssueEdit
from app.security import CurrentAdmin
from app.voting import Voter

router = APIRouter(tags=["community issues"])
MAX_PHOTO_BYTES = 10 * 1024 * 1024
ISSUE_SQL = "SELECT id, title, description, latitude, longitude, status, category, created_at FROM community_issues"


def normalize_photo(data: bytes) -> bytes:
    """A clean JPEG of the photo, or ValueError if it isn't a usable image.

    Decode and re-encode instead of trusting filenames or MIME headers. This also
    strips EXIF (including GPS) and gives the analysis pipeline one format.
    """
    try:
        with Image.open(io.BytesIO(data)) as image:
            if image.format not in {"JPEG", "PNG", "WEBP"}:
                raise ValueError("Unsupported image")
            if image.width * image.height > 25_000_000:
                raise ValueError("Image too large")
            image = ImageOps.exif_transpose(image)
            image.thumbnail((2048, 2048))
            output = io.BytesIO()
            image.convert("RGB").save(output, format="JPEG", quality=85)
            return output.getvalue()
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError) as error:
        raise ValueError("Unreadable image") from error


def issue_record(database: Database, issue_id: int):
    row = database.execute(f"{ISSUE_SQL} WHERE id = ?", (issue_id,)).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Community issue not found")
    return dict(row)


@router.post("/issues", response_model=CommunityIssue, status_code=201)
async def create_issue(
    database: Database,
    voter: Voter,
    title: Annotated[str, Form(min_length=1, max_length=200)],
    description: Annotated[str, Form(min_length=1, max_length=5000)],
    latitude: Annotated[float, Form(ge=-90, le=90)],
    longitude: Annotated[float, Form(ge=-180, le=180)],
    photo: UploadFile,
    # Optional so older app builds without the tag picker can still report
    category: Annotated[IssueCategory, Form()] = "other",
):
    title, description = title.strip(), description.strip()
    if not title or not description:
        raise HTTPException(status_code=422, detail="Add a title and description")
    data = await photo.read(MAX_PHOTO_BYTES + 1)
    if len(data) > MAX_PHOTO_BYTES:
        raise HTTPException(status_code=413, detail="Choose a photo smaller than 10 MB")
    try:
        normalized = normalize_photo(data)
    except ValueError as error:
        raise HTTPException(
            status_code=415,
            detail="Choose a valid JPEG, PNG or WebP photo (up to 25 megapixels)",
        ) from error
    cursor = database.execute(
        "INSERT INTO community_issues (title, description, latitude, longitude, owner_key, category) VALUES (?, ?, ?, ?, ?, ?)",
        (title, description, latitude, longitude, voter, category),
    )
    issue_id = cursor.lastrowid
    database.execute(
        "INSERT INTO issue_photos (issue_id, content_type, size, data) VALUES (?, 'image/jpeg', ?, ?)",
        (issue_id, len(normalized), normalized),
    )
    database.execute(
        "INSERT INTO notifications (recipient, issue_id) VALUES (?, ?)",
        (voter, issue_id),
    )
    return issue_record(database, issue_id)


@router.get("/issues", response_model=list[CommunityIssue])
def list_issues(database: Database, voter: Voter):
    return [
        dict(row)
        for row in database.execute(
            f"{ISSUE_SQL} WHERE owner_key = ? ORDER BY id DESC", (voter,)
        )
    ]


@router.get("/issues/{issue_id}/photo")
def issue_photo(issue_id: int, database: Database):
    row = database.execute(
        "SELECT content_type, data FROM issue_photos WHERE issue_id = ?", (issue_id,)
    ).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Photo not found")
    return Response(
        content=row["data"],
        media_type=row["content_type"],
        headers={"X-Content-Type-Options": "nosniff"},
    )


@router.get("/admin/issues", response_model=list[CommunityIssue])
def admin_issues(database: Database, _admin: CurrentAdmin):
    return [dict(row) for row in database.execute(f"{ISSUE_SQL} ORDER BY id DESC")]


@router.patch("/issues/{issue_id}", response_model=CommunityIssue)
def edit_issue(issue_id: int, changes: IssueEdit, database: Database, voter: Voter):
    cursor = database.execute(
        "UPDATE community_issues SET title = ?, description = ? WHERE id = ? AND owner_key = ?",
        (changes.title, changes.description, issue_id, voter),
    )
    if cursor.rowcount == 0:
        raise HTTPException(status_code=404, detail="Issue not found")
    database.execute("DELETE FROM issue_analyses WHERE issue_id = ?", (issue_id,))
    return issue_record(database, issue_id)


@router.delete("/issues/{issue_id}", status_code=204)
def delete_issue(issue_id: int, database: Database, voter: Voter):
    cursor = database.execute(
        "DELETE FROM community_issues WHERE id = ? AND owner_key = ?", (issue_id, voter)
    )
    if cursor.rowcount == 0:
        raise HTTPException(status_code=404, detail="Issue not found")
    return Response(status_code=204)
