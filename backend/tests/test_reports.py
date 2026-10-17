"""The admin Reports gallery: category tags, the photo folder, and severity estimates."""

import io

import pytest
from PIL import Image
from fastapi.testclient import TestClient

from app import feedback, reports
from app.database import connect, initialize
from app.main import create_app
from app.security import hash_password

ADMIN = {"identifier": "officer@southampton.gov.uk", "password": "officer-password"}
FIELDS = {
    "title": "Deep pothole",
    "description": "On the high street.",
    "latitude": "50.91",
    "longitude": "-1.41",
}


def photo(fmt="PNG", exif=None):
    output = io.BytesIO()
    Image.new("RGB", (20, 10), "grey").save(
        output, fmt, **({"exif": exif} if exif else {})
    )
    return output.getvalue()


@pytest.fixture
def client(tmp_path):
    with TestClient(create_app(tmp_path / "test.db", background_jobs=False)) as api:
        with connect(api.app.state.database_path) as database:
            database.execute(
                "INSERT INTO users (email, password_hash) VALUES (?, ?)",
                (ADMIN["identifier"], hash_password(ADMIN["password"])),
            )
            database.execute(
                "INSERT INTO admins (email, name) VALUES (?, 'Pat Officer')",
                (ADMIN["identifier"],),
            )
        yield api


@pytest.fixture
def auth(client):
    token = client.post("/auth/login", json=ADMIN).json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def submit(client, **fields):
    return client.post(
        "/issues",
        data={**FIELDS, **fields},
        files={"photo": ("photo.png", photo(), "image/png")},
    )


def test_reports_carry_the_residents_category(client, auth):
    assert submit(client, category="pothole").json()["category"] == "pothole"
    assert submit(client, category="graffiti").json()["category"] == "graffiti"
    # Older app builds send no tag
    assert submit(client).json()["category"] == "other"
    assert submit(client, category="volcano").status_code == 422
    assert client.get("/admin/reports").status_code == 401
    page = client.get("/admin/reports", headers=auth).json()
    assert [r["category"] for r in page["reports"]] == ["other", "graffiti", "pothole"]
    assert all(r["severity"] is None for r in page["reports"])
    assert page["pending"] == 3
    assert page["job"]["running"] is False


def test_category_column_is_added_to_existing_databases(tmp_path):
    path = tmp_path / "old.db"
    with connect(path) as database:
        database.execute(
            "CREATE TABLE community_issues (id INTEGER PRIMARY KEY AUTOINCREMENT, "
            "title TEXT NOT NULL, description TEXT NOT NULL, latitude REAL NOT NULL, "
            "longitude REAL NOT NULL, owner_key TEXT NOT NULL, status TEXT NOT NULL "
            "DEFAULT 'submitted', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"
        )
        database.execute(
            "INSERT INTO community_issues (title, description, latitude, longitude, owner_key) "
            "VALUES ('Old', 'Kept', 50.9, -1.4, 'guest:x')"
        )
    initialize(path)
    initialize(path)
    with connect(path) as database:
        row = database.execute(
            "SELECT title, category FROM community_issues"
        ).fetchone()
        assert tuple(row) == ("Old", "other")


def test_photos_dropped_in_the_folder_become_reports_once(client, auth):
    folder = reports.photo_folder(client.app.state.database_path)
    page = client.get("/admin/reports", headers=auth).json()
    assert page["folder"] == str(folder.resolve())
    assert {p.name for p in folder.iterdir()} == {"pothole", "graffiti", "other"}

    gps = Image.Exif()
    gps[0x8825] = {1: "N", 2: (50.0, 54.0, 0.0), 3: "W", 4: (1.0, 24.0, 0.0)}
    (folder / "pothole" / "big-pothole_on_high-st.jpg").write_bytes(
        photo("JPEG", exif=gps)
    )
    (folder / "graffiti" / "tag.png").write_bytes(photo())
    (folder / "other" / "notes.txt").write_text("not a photo")
    (folder / "other" / ".DS_Store").write_bytes(b"\0")

    page = client.get("/admin/reports", headers=auth).json()
    assert page["skipped"] == ["other/notes.txt"]
    by_title = {r["title"]: r for r in page["reports"]}
    assert set(by_title) == {"Big pothole on high st", "Tag"}
    pothole = by_title["Big pothole on high st"]
    assert pothole["category"] == "pothole"
    assert (pothole["latitude"], pothole["longitude"]) == (50.9, -1.4)
    # No GPS in the photo: pinned to the city centre
    assert (by_title["Tag"]["latitude"], by_title["Tag"]["longitude"]) == (
        reports.SOUTHAMPTON
    )
    image = client.get(f"/issues/{pothole['id']}/photo")
    with Image.open(io.BytesIO(image.content)) as decoded:
        assert not decoded.getexif()  # GPS read for the pin, then stripped

    assert len(client.get("/admin/reports", headers=auth).json()["reports"]) == 2


def test_severity_uses_a_vision_model_and_is_stored(client, auth, monkeypatch):
    submit(client, category="pothole", title="Deep pothole")
    submit(client, category="graffiti", title="Small tag")
    calls = []

    def fake_model(model, prompt, system, schema, images=None, num_ctx=0):
        calls.append({"model": model, "prompt": prompt, "images": images})
        assert system == reports.SEVERITY_PROMPT and schema == reports.SEVERITY_SCHEMA
        if "Pothole" in prompt:
            return {"severity": 3, "reason": "  Deep hole\nin a busy road. "}
        return {"severity": 1, "reason": "Small tag."}

    monkeypatch.setattr(feedback, "pick_vision_model", lambda: ("llava:7b", True))
    monkeypatch.setattr(feedback, "ask_model", fake_model)
    page = client.post("/admin/reports/assess", headers=auth).json()
    assert page["pending"] == 0
    assert page["job"]["error"] is None and page["job"]["done"] == 2
    by_title = {r["title"]: r["severity"] for r in page["reports"]}
    assert by_title["Deep pothole"]["level"] == 3
    assert by_title["Deep pothole"]["reason"] == "Deep hole in a busy road."
    assert by_title["Deep pothole"]["saw_photo"] is True
    assert by_title["Small tag"]["level"] == 1
    assert all(len(c["images"]) == 1 for c in calls)
    assert "Category: Pothole" in calls[1]["prompt"]

    # Already assessed: nothing to do until forced
    calls.clear()
    client.post("/admin/reports/assess", headers=auth)
    assert not calls
    client.post("/admin/reports/assess", params={"force": True}, headers=auth)
    assert len(calls) == 2
    with connect(client.app.state.database_path) as database:
        assert (
            database.execute("SELECT count(*) FROM issue_analyses").fetchone()[0] == 2
        )


def test_severity_falls_back_to_text_and_reports_bad_answers(client, auth, monkeypatch):
    submit(client)
    seen = []

    def text_only(model, prompt, system, schema, images=None, num_ctx=0):
        seen.append(images)
        return {"severity": 2, "reason": "Needs a look."}

    monkeypatch.setattr(feedback, "pick_vision_model", lambda: ("qwen3:8b", False))
    monkeypatch.setattr(feedback, "ask_model", text_only)
    page = client.post("/admin/reports/assess", headers=auth).json()
    assert seen == [None]
    assert page["reports"][0]["severity"]["saw_photo"] is False

    submit(client)
    monkeypatch.setattr(
        feedback, "ask_model", lambda *args, **kwargs: {"severity": 7, "reason": "?"}
    )
    page = client.post("/admin/reports/assess", headers=auth).json()
    assert page["pending"] == 1
    assert page["job"]["error"] == "The model didn’t give a severity"


def test_vision_model_choice(monkeypatch):
    tags = {
        "models": [
            {"name": "qwen3:8b"},
            {"name": "gemma3:cloud"},
            {"name": "llava:7b"},
        ]
    }
    shows = {"qwen3:8b": ["completion"], "llava:7b": ["completion", "vision"]}

    def fake_request(path, body=None):
        return tags if path == "/api/tags" else {"capabilities": shows[body["model"]]}

    monkeypatch.setattr(feedback, "_request", fake_request)
    monkeypatch.setattr(feedback, "OLLAMA_MODEL", "")
    monkeypatch.setattr(feedback, "OLLAMA_VISION_MODEL", "")
    assert feedback.pick_vision_model() == ("llava:7b", True)
    shows["llava:7b"] = ["completion"]
    assert feedback.pick_vision_model() == ("qwen3:8b", False)
    monkeypatch.setattr(feedback, "OLLAMA_VISION_MODEL", "gemma3:cloud")
    with pytest.raises(feedback.AnalysisUnavailable):
        feedback.pick_vision_model()
