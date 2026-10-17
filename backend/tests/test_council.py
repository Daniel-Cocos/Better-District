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
        assert event == {"id": 1, "likes": 0, "dislikes": 0, **EVENT}
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
        }
        api.post("/events", json={**EVENT, "title": "Another project"})
        assert api.get("/events/2/comments").json() == []
    with TestClient(create_app(path)) as api:
        assert len(api.get("/events").json()) == 2
        assert api.get("/events/1/comments").json() == [comment]


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
