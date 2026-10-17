"""Integration tests for events, comments, authentication, and SQL seed data."""

import sqlite3

import pytest
from fastapi.testclient import TestClient

from app.database import BACKEND_DIR, connect, initialize
from app.main import create_app


@pytest.fixture
def client(tmp_path):
    with TestClient(create_app(tmp_path / "test.db")) as test_client:
        yield test_client


EVENT = {
    "title": "Library renovation",
    "description": "Improve access and study spaces.",
    "latitude": 50.9081,
    "longitude": -1.4043,
    "closes_at": "2026-11-01T17:00:00Z",
}
USER = {"email": "resident@example.com", "password": "my-test-password"}
AUTH = (USER["email"], USER["password"])


def test_events_comments_and_persistence(tmp_path):
    path = tmp_path / "test.db"
    with TestClient(create_app(path)) as api:
        assert api.get("/health").status_code == 200
        assert api.get("/events").json() == []
        response = api.post("/events", json=EVENT)
        assert response.status_code == 201
        event = response.json()
        assert event == {"id": 1, "likes": 0, "dislikes": 0, "my_vote": 0, **EVENT}
        assert api.get("/events/1").json() == event
        assert api.get("/events").json() == [event]
        assert api.get("/events/1/comments").json() == []
        response = api.post("/events/1/comments", json={"body": "Good idea!"})
        assert response.status_code == 201
        comment = response.json()
        assert comment == {
            "id": 1,
            "event_id": 1,
            "body": "Good idea!",
            "user_email": None,
            "likes": 0,
            "dislikes": 0,
            "my_vote": 0,
            "is_mine": True,
        }
        api.post("/events", json={**EVENT, "title": "Another project"})
        assert api.get("/events/2/comments").json() == []
    with TestClient(create_app(path)) as api:
        assert len(api.get("/events").json()) == 2
        assert api.get("/events/1/comments").json() == [{**comment, "is_mine": False}]


def test_users_and_authenticated_comments(client):
    response = client.post("/users", json={**USER, "email": "Resident@Example.com"})
    assert response.status_code == 201
    assert response.json() == {"email": USER["email"]}
    assert client.post("/users", json=USER).status_code == 409
    assert client.get("/users/me").status_code == 401
    assert client.get("/users/me", auth=AUTH).json() == {"email": USER["email"]}
    for auth in ((USER["email"], "incorrect"), ("missing@example.com", "incorrect")):
        assert client.get("/users/me", auth=auth).status_code == 401
    client.post("/events", json=EVENT)
    response = client.post("/events/1/comments", json={"body": "Thanks!"}, auth=AUTH)
    assert response.status_code == 201
    assert response.json()["user_email"] == USER["email"]
    response = client.post(
        "/events/1/comments", json={"body": "Nope"}, auth=(AUTH[0], "bad")
    )
    assert response.status_code == 401
    assert len(client.get("/events/1/comments").json()) == 1
    with connect(client.app.state.database_path) as database:
        stored = database.execute("SELECT password_hash FROM users").fetchone()[0]
        assert stored.startswith("scrypt$")
        assert USER["password"] not in stored


def test_validation_and_missing_events(client):
    assert client.get("/events/999").status_code == 404
    assert client.get("/events/999/comments").status_code == 404
    assert client.post("/events/999/comments", json={"body": "Hi"}).status_code == 404
    for change in ({"title": "   "}, {"latitude": 91}, {"longitude": -181}):
        assert client.post("/events", json={**EVENT, **change}).status_code == 422
    client.post("/events", json=EVENT)
    assert client.post("/events/1/comments", json={"body": " "}).status_code == 422
    assert client.post("/users", json={**USER, "email": "invalid"}).status_code == 422
    assert client.post("/users", json={**USER, "password": "short"}).status_code == 422


def test_event_deadlines_require_timezone_and_are_stored_in_utc(client):
    for deadline in (None, "not-a-date", "2026-11-01T17:00:00"):
        assert (
            client.post("/events", json={**EVENT, "closes_at": deadline}).status_code
            == 422
        )
    missing = {key: value for key, value in EVENT.items() if key != "closes_at"}
    assert client.post("/events", json=missing).status_code == 422
    response = client.post(
        "/events", json={**EVENT, "closes_at": "2026-11-01T18:00:00+01:00"}
    )
    assert response.status_code == 201
    assert response.json()["closes_at"] == EVENT["closes_at"]
    assert client.get("/events/1").json()["closes_at"] == EVENT["closes_at"]


def test_existing_database_gets_deadline_column_without_losing_data(tmp_path):
    path = tmp_path / "legacy.db"
    schema = (
        (BACKEND_DIR / "sql" / "schema.sql")
        .read_text()
        .replace("    closes_at TEXT,\n", "")
        .replace("    owner_key TEXT,\n", "")
    )
    with connect(path) as database:
        database.executescript(schema)
        database.execute(
            "INSERT INTO events (title, description, latitude, longitude) VALUES ('Legacy event', 'Keep me', 50.91, -1.40)"
        )
        database.execute(
            "INSERT INTO comments (event_id, body) VALUES (1, 'Keep comment')"
        )
    initialize(path)
    initialize(path)
    with TestClient(create_app(path)) as api:
        assert api.get("/events/1").json()["title"] == "Legacy event"
        assert api.get("/events/1").json()["closes_at"] is None
        assert api.get("/events/1/comments").json()[0]["body"] == "Keep comment"


def test_seed_is_repeatable_and_foreign_keys_are_enforced(tmp_path):
    path = tmp_path / "seed.db"
    initialize(path)
    sql = (BACKEND_DIR / "sql" / "seed.sql").read_text()
    with connect(path) as database:
        database.executescript(sql)
        database.executescript(sql)
        assert database.execute("SELECT count(*) FROM events").fetchone()[0] == 5
        assert database.execute("SELECT count(*) FROM comments").fetchone()[0] == 10
        assert database.execute("SELECT count(*) FROM users").fetchone()[0] == 3
        assert database.execute("SELECT count(*) FROM admins").fetchone()[0] == 1
        locations = database.execute(
            "SELECT latitude, longitude FROM events"
        ).fetchall()
        assert all(50.88 <= row[0] <= 50.95 for row in locations)
        assert all(-1.45 <= row[1] <= -1.35 for row in locations)
        titles = [row[0] for row in database.execute("SELECT title FROM events")]
        assert any("Southampton Common" in title for title in titles)
        assert any("Old Town" in title for title in titles)
        assert all(
            "Fictional demo event" in row[0]
            for row in database.execute("SELECT description FROM events")
        )
        assert database.execute("PRAGMA foreign_key_check").fetchall() == []
        with pytest.raises(sqlite3.IntegrityError):
            database.execute(
                "INSERT INTO comments (event_id, body) VALUES (999, 'Invalid')"
            )
        with pytest.raises(sqlite3.IntegrityError):
            database.execute(
                "INSERT INTO comments (event_id, body, user_email) VALUES (1, 'Invalid', 'missing')"
            )
    with TestClient(create_app(path)) as api:
        response = api.get("/users/me", auth=("alex@example.com", "council-demo-2026"))
        assert response.status_code == 200


def test_votes_toggle_and_are_personalized(client):
    client.post("/events", json=EVENT)
    for vote, likes, dislikes in ((1, 1, 0), (1, 1, 0), (-1, 0, 1), (0, 0, 0)):
        response = client.put("/events/1/vote", json={"vote": vote})
        assert response.status_code == 200
        assert (response.json()["likes"], response.json()["dislikes"]) == (
            likes,
            dislikes,
        )
        assert response.json()["my_vote"] == vote
    client.put("/events/1/vote", json={"vote": 1})
    with TestClient(client.app) as other:
        event = other.get("/events/1").json()
        assert event["likes"] == 1
        assert event["my_vote"] == 0
        assert other.put("/events/1/vote", json={"vote": -1}).json()["dislikes"] == 1
    assert client.get("/events/1").json()["my_vote"] == 1
    assert client.put("/events/1/vote", json={"vote": 2}).status_code == 422
    assert client.put("/events/999/vote", json={"vote": 1}).status_code == 404


def test_guest_comment_ownership_history_and_deletion(client):
    client.post("/events", json=EVENT)
    comment = client.post("/events/1/comments", json={"body": "Original"}).json()
    assert comment["is_mine"] is True
    for vote in (1, -1):
        assert (
            client.put("/events/1/comments/1/vote", json={"vote": vote}).status_code
            == 403
        )
    assert client.get("/users/me/comments").json()[0]["event_title"] == EVENT["title"]
    with TestClient(client.app) as other:
        assert other.get("/users/me/comments").json() == []
        assert other.get("/events/1/comments").json()[0]["is_mine"] is False
        assert (
            other.patch("/events/1/comments/1", json={"body": "Stolen"}).status_code
            == 403
        )
        assert other.delete("/events/1/comments/1").status_code == 403
        assert (
            other.put("/events/1/comments/1/vote", json={"vote": 1}).json()["likes"]
            == 1
        )
    updated = client.patch("/events/1/comments/1", json={"body": " Edited "}).json()
    assert updated["body"] == "Edited"
    assert updated["likes"] == 1
    assert updated["is_mine"] is True
    assert client.patch("/events/1/comments/1", json={"body": " "}).status_code == 422
    client.post("/events", json=EVENT)
    assert client.put("/events/2/comments/1/vote", json={"vote": 1}).status_code == 404
    assert client.delete("/events/1/comments/1").status_code == 204
    assert client.get("/users/me/comments").json() == []
    assert client.get("/events/1/comments").json() == []
    with connect(client.app.state.database_path) as database:
        assert database.execute("SELECT count(*) FROM comment_votes").fetchone()[0] == 0


def test_account_comment_ownership_survives_a_new_client(client):
    client.post("/events", json=EVENT)
    client.post("/users", json=USER)
    client.post("/events/1/comments", json={"body": "Account comment"}, auth=AUTH)
    assert (
        client.put("/events/1/comments/1/vote", json={"vote": 1}, auth=AUTH).status_code
        == 403
    )
    assert client.get("/users/me/comments").json() == []
    with TestClient(client.app) as other:
        assert other.get("/users/me/comments", auth=AUTH).json()[0]["is_mine"] is True
        assert (
            other.patch(
                "/events/1/comments/1", json={"body": "Updated"}, auth=AUTH
            ).status_code
            == 200
        )
        assert other.delete("/events/1/comments/1", auth=AUTH).status_code == 204
