"""Photographed community proposals persist independently of council projects."""

import io
import sqlite3
import pytest
from PIL import Image
from fastapi.testclient import TestClient
from app.database import connect, initialize
from app.main import create_app
from app.security import hash_password


def photo():
    output = io.BytesIO()
    Image.new("RGB", (20, 10), "blue").save(output, "PNG")
    return output.getvalue()


@pytest.fixture
def client(tmp_path):
    with TestClient(create_app(tmp_path / "issues.db")) as api:
        yield api


FIELDS = {
    "title": " Safer crossing ",
    "description": " Add a crossing near the school. ",
    "latitude": "50.91",
    "longitude": "-1.41",
}


def submit(client, fields=None, content=None):
    return client.post(
        "/issues",
        data=fields or FIELDS,
        files={
            "photo": ("photo.png", photo() if content is None else content, "image/png")
        },
    )


def test_issue_photo_location_and_persistence(client):
    response = submit(client)
    assert response.status_code == 201
    issue = response.json()
    assert issue["title"] == "Safer crossing"
    assert issue["description"] == FIELDS["description"].strip()
    assert issue["latitude"] == 50.91
    assert issue["longitude"] == -1.41
    assert issue["status"] == "submitted"
    assert "owner_key" not in issue
    assert client.get("/issues").json() == [issue]
    image = client.get(f"/issues/{issue['id']}/photo")
    assert image.status_code == 200
    assert image.headers["content-type"] == "image/jpeg"
    with Image.open(io.BytesIO(image.content)) as decoded:
        assert decoded.size == (20, 10)
        assert not decoded.getexif()
    assert client.get("/admin/issues").status_code == 401
    with connect(client.app.state.database_path) as database:
        assert (
            database.execute("SELECT owner_key FROM community_issues")
            .fetchone()[0]
            .startswith("guest:")
        )
        assert database.execute("SELECT count(*) FROM events").fetchone()[0] == 0
        assert (
            database.execute("SELECT count(*) FROM issue_analyses").fetchone()[0] == 0
        )
        database.execute(
            "INSERT INTO users VALUES (?, ?)",
            ("officer@example.com", hash_password("password123")),
        )
        database.execute(
            "INSERT INTO admins (email, name) VALUES (?, ?)",
            ("officer@example.com", "Officer"),
        )
    token = client.post(
        "/auth/login",
        json={"identifier": "officer@example.com", "password": "password123"},
    ).json()["access_token"]
    assert client.get(
        "/admin/issues", headers={"Authorization": f"Bearer {token}"}
    ).json() == [issue]
    initialize(client.app.state.database_path)
    assert client.get("/issues").json() == [issue]
    assert client.get(f"/issues/{issue['id']}/photo").content == image.content


@pytest.mark.parametrize(
    "changes",
    [
        {"title": " "},
        {"description": ""},
        {"latitude": "91"},
        {"longitude": "-181"},
        {"latitude": "nan"},
    ],
)
def test_issue_validation(client, changes):
    assert submit(client, {**FIELDS, **changes}).status_code == 422
    assert client.get("/issues").json() == []


def test_photos_required_validated_and_limited(client):
    assert client.post("/issues", data=FIELDS).status_code == 422
    assert submit(client, content=b"<script>bad</script>").status_code == 415
    assert submit(client, content=b"x" * (10 * 1024 * 1024 + 1)).status_code == 413
    assert client.get("/issues").json() == []
    assert client.get("/issues/999/photo").status_code == 404


def test_schema_additive_and_analysis_constraints(tmp_path):
    path = tmp_path / "old.db"
    initialize(path)
    with connect(path) as database:
        database.execute(
            "INSERT INTO events (title, description, latitude, longitude) VALUES ('Existing', 'Keep', 50.9, -1.4)"
        )
    initialize(path)
    with connect(path) as database:
        assert database.execute("SELECT title FROM events").fetchone()[0] == "Existing"
        with pytest.raises(sqlite3.IntegrityError):
            database.execute(
                "INSERT INTO community_issues (title, description, latitude, longitude, owner_key) VALUES ('Test', 'Test', 91, 0, 'guest:test')"
            )


def test_signed_in_report_strips_photo_metadata_and_cascades(client):
    credentials = ("resident@example.com", "resident-password")
    assert (
        client.post(
            "/users", json={"email": credentials[0], "password": credentials[1]}
        ).status_code
        == 201
    )
    output = io.BytesIO()
    exif = Image.Exif()
    exif[274] = 6  # A portrait image stored sideways by the camera.
    exif[270] = "Private original metadata"
    Image.new("RGB", (30, 10), "red").save(output, "JPEG", exif=exif)
    response = client.post(
        "/issues",
        auth=credentials,
        data=FIELDS,
        files={"photo": ("original.jpg", output.getvalue(), "image/jpeg")},
    )
    assert response.status_code == 201
    issue_id = response.json()["id"]
    image = client.get(f"/issues/{issue_id}/photo")
    with Image.open(io.BytesIO(image.content)) as decoded:
        assert decoded.size == (10, 30)
        assert not decoded.getexif()
    with connect(client.app.state.database_path) as database:
        assert (
            database.execute(
                "SELECT owner_key FROM community_issues WHERE id = ?", (issue_id,)
            ).fetchone()[0]
            == f"user:{credentials[0]}"
        )
        database.execute(
            "INSERT INTO issue_analyses (issue_id, model_version, result_json) VALUES (?, 'test-v1', '{}')",
            (issue_id,),
        )
        database.execute("DELETE FROM community_issues WHERE id = ?", (issue_id,))
        assert database.execute("SELECT count(*) FROM issue_photos").fetchone()[0] == 0
        assert (
            database.execute("SELECT count(*) FROM issue_analyses").fetchone()[0] == 0
        )


def test_my_issues_and_submission_notification(client):
    response = submit(client)
    assert response.status_code == 201
    issue = response.json()
    assert client.get("/issues").json() == [issue]
    notices = client.get("/users/me/notifications").json()
    assert len(notices) == 1
    notice = notices[0]
    assert notice["kind"] == "issue_submitted"
    assert notice["issue_id"] == issue["id"]
    assert notice["event_title"] == issue["title"]
    assert notice["is_read"] is False
    assert (
        client.patch(f"/users/me/notifications/{notice['id']}/read").status_code == 200
    )
    assert client.get("/users/me/notifications").json()[0]["is_read"] is True
    with TestClient(client.app) as other:
        assert other.get("/issues").json() == []
        assert other.get("/users/me/notifications").json() == []
        assert (
            other.patch(f"/users/me/notifications/{notice['id']}/read").status_code
            == 404
        )


def test_notification_migration_preserves_existing_replies(tmp_path):
    path = tmp_path / "migration.db"
    initialize(path)
    with connect(path) as database:
        database.execute(
            "INSERT INTO events (title, description, latitude, longitude) VALUES ('Existing', 'Keep', 50.9, -1.4)"
        )
        database.execute(
            "INSERT INTO comments (event_id, body) VALUES (1, 'Existing reply')"
        )
        database.execute("DROP TABLE notifications")
        database.execute(
            "CREATE TABLE notifications (id INTEGER PRIMARY KEY AUTOINCREMENT, recipient TEXT NOT NULL, comment_id INTEGER NOT NULL REFERENCES comments(id) ON DELETE CASCADE, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, is_read INTEGER NOT NULL DEFAULT 0)"
        )
        database.execute(
            "INSERT INTO notifications (id, recipient, comment_id, is_read) VALUES (7, 'user:resident@example.com', 1, 1)"
        )
    initialize(path)
    initialize(path)
    with connect(path) as database:
        row = database.execute("SELECT * FROM notifications WHERE id = 7").fetchone()
        assert row["comment_id"] == 1
        assert row["issue_id"] is None
        assert row["is_read"] == 1
        assert row["recipient"] == "user:resident@example.com"


def test_issue_edit_delete_and_ownership(client):
    issue = submit(client).json()
    url = f"/issues/{issue['id']}"
    original_photo = client.get(f"{url}/photo").content
    with TestClient(client.app) as other:
        assert (
            other.patch(
                url, json={"title": "Changed", "description": "Changed"}
            ).status_code
            == 404
        )
        assert other.delete(url).status_code == 404
    assert (
        client.patch(url, json={"title": " ", "description": "Valid"}).status_code
        == 422
    )
    response = client.patch(
        url, json={"title": " Updated crossing ", "description": " More detail "}
    )
    assert response.status_code == 200
    assert response.json() == {
        **issue,
        "title": "Updated crossing",
        "description": "More detail",
    }
    assert client.get("/issues").json() == [response.json()]
    assert client.get(f"{url}/photo").content == original_photo
    assert client.delete(url).status_code == 204
    assert client.get("/issues").json() == []
    assert client.get(f"{url}/photo").status_code == 404
    assert client.get("/users/me/notifications").json() == []
    assert client.delete(url).status_code == 404


def test_owner_replaces_issue_photo(client):
    issue = submit(client).json()
    assert issue["photo_version"] == 1
    url = f"/issues/{issue['id']}/photo"
    original_photo = client.get(url).content
    output = io.BytesIO()
    Image.new("RGB", (16, 12), "green").save(output, "PNG")
    replacement = {"photo": ("cropped.png", output.getvalue(), "image/png")}
    with TestClient(client.app) as other:
        assert other.put(url, files=replacement).status_code == 404
    assert (
        client.put(url, files={"photo": ("bad.png", b"bad", "image/png")}).status_code
        == 415
    )
    assert client.get(url).content == original_photo
    with connect(client.app.state.database_path) as database:
        database.execute(
            "INSERT INTO issue_analyses (issue_id, model_version, result_json) VALUES (?, 'test-v1', '{}')",
            (issue["id"],),
        )
    response = client.put(url, files=replacement)
    assert response.status_code == 200
    assert response.json() == {**issue, "photo_version": 2}
    assert client.get("/issues").json() == [response.json()]
    with Image.open(io.BytesIO(client.get(url).content)) as decoded:
        assert decoded.size == (16, 12)
    with connect(client.app.state.database_path) as database:
        assert (
            database.execute("SELECT count(*) FROM issue_analyses").fetchone()[0] == 0
        )
    assert client.put("/issues/999/photo", files=replacement).status_code == 404


def test_photo_version_migration(tmp_path):
    path = tmp_path / "photos.db"
    initialize(path)
    with connect(path) as database:
        database.execute("DROP TABLE issue_photos")
        database.execute(
            "CREATE TABLE issue_photos (issue_id INTEGER PRIMARY KEY REFERENCES community_issues(id) ON DELETE CASCADE, content_type TEXT NOT NULL, size INTEGER NOT NULL CHECK (size > 0), data BLOB NOT NULL)"
        )
        database.execute(
            "INSERT INTO community_issues (title, description, latitude, longitude, owner_key) VALUES ('Old', 'Old', 50.9, -1.4, 'guest:test')"
        )
        database.execute(
            "INSERT INTO issue_photos (issue_id, content_type, size, data) VALUES (1, 'image/jpeg', 1, x'00')"
        )
    initialize(path)
    with connect(path) as database:
        assert database.execute("SELECT version FROM issue_photos").fetchone()[0] == 1
