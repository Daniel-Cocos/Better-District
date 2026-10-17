"""Integration tests for the admin website: sign-in, drafts, uploads, and publishing."""

from datetime import date

import pytest
from fastapi.testclient import TestClient

from app.database import connect, initialize
from app.deadlines import feedback_deadline
from app.main import create_app
from app.routes import live
from app.security import hash_password

ADMIN = {"identifier": "officer@southampton.gov.uk", "password": "officer-password"}

FORM = {
    "title": "Bargate square",
    "stage": "live_trial",
    "feedback_opens": "2026-11-01",
    "feedback_closes": "2026-12-01",
    "team": "Transport",
    "contact": "transport@southampton.gov.uk",
    "location": {"latitude": 50.9052, "longitude": -1.4044, "radius_m": 300},
    "ward": "Bargate",
    "summary": "A six-month trial of a pedestrian square.",
    "commitments": "- Publish results",
    "custom_fields": [{"label": "Budget", "value": "£120,000"}],
    "permanent": ["The trial runs for six months"],
    "changeable": ["Hours of operation"],
    "questions": [
        {
            "type": "single_choice",
            "prompt": "Do you support the trial?",
            "options": ["Yes", "No"],
            "required": True,
        }
    ],
    "engagement": {
        "default_questions": True,
        "custom_comments": True,
        "comment_replies": False,
        "demographics": ["age_range"],
    },
}


@pytest.fixture
def client(tmp_path):
    with TestClient(create_app(tmp_path / "test.db")) as test_client:
        with connect(test_client.app.state.database_path) as database:
            database.execute(
                "INSERT INTO users (email, password_hash) VALUES (?, ?), (?, ?)",
                (
                    ADMIN["identifier"],
                    hash_password(ADMIN["password"]),
                    "resident@example.com",
                    hash_password("resident-password"),
                ),
            )
            database.execute(
                "INSERT INTO admins (email, name) VALUES (?, 'Pat Officer')",
                (ADMIN["identifier"],),
            )
        yield test_client


@pytest.fixture
def auth(client):
    token = client.post("/auth/login", json=ADMIN).json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_admin_sign_in_and_out(client):
    assert client.get("/auth/me").status_code == 401
    assert client.get("/admin/overview").status_code == 401
    for body in (
        {**ADMIN, "password": "wrong"},
        {"identifier": "resident@example.com", "password": "resident-password"},
    ):
        assert client.post("/auth/login", json=body).status_code == 401
    response = client.post(
        "/auth/login", json={**ADMIN, "identifier": " Officer@Southampton.gov.uk "}
    )
    assert response.status_code == 200
    headers = {"Authorization": f"Bearer {response.json()['access_token']}"}
    assert client.get("/auth/me", headers=headers).json() == {
        "email": ADMIN["identifier"],
        "name": "Pat Officer",
        "job_title": "",
    }
    assert client.post("/auth/logout", headers=headers).status_code == 204
    assert client.get("/auth/me", headers=headers).status_code == 401


def test_draft_then_publish(client, auth):
    response = client.post("/admin/drafts", json={"title": "Half done"}, headers=auth)
    assert response.status_code == 201
    draft = response.json()
    assert draft["form"]["title"] == "Half done"
    response = client.put(
        f"/admin/drafts/{draft['id']}", json={"title": "Renamed"}, headers=auth
    )
    assert response.json()["form"]["title"] == "Renamed"
    assert [d["title"] for d in client.get("/admin/drafts", headers=auth).json()] == [
        "Renamed"
    ]
    # Drafts stay off the public map
    assert client.get("/events").json() == []

    response = client.post(
        "/admin/uploads",
        files={"file": ("plan.txt", b"Trial plan", "text/plain")},
        headers=auth,
    )
    assert response.status_code == 201
    document = response.json()
    assert client.get(f"/admin/uploads/{document['id']}", headers=auth).content == (
        b"Trial plan"
    )

    response = client.put(
        f"/admin/drafts/{draft['id']}",
        json={"document_ids": [document["id"]]},
        headers=auth,
    )
    assert response.json()["documents"] == [document]

    response = client.post(
        "/admin/projects",
        json={**FORM, "document_ids": [document["id"]], "draft_id": draft["id"]},
        headers=auth,
    )
    assert response.status_code == 201
    project = response.json()
    assert project["event_id"] == 1
    assert project["documents"] == [document]
    for key, value in FORM.items():
        assert project[key] == value, key
    assert project["created_by"] == ADMIN["identifier"]
    assert client.get("/admin/drafts", headers=auth).json() == []
    assert client.get("/admin/projects/1", headers=auth).json() == project

    # Published projects are ordinary events for the app
    (event,) = client.get("/events").json()
    assert event["title"] == FORM["title"]
    assert event["description"] == FORM["summary"]
    assert (event["latitude"], event["longitude"]) == (50.9052, -1.4044)
    # Feedback closes at the end of 1 December in Southampton (GMT in winter)
    assert event["closes_at"] == "2026-12-01T23:59:59Z"


def test_publish_validation(client, auth):
    response = client.post("/admin/projects", json={"title": "Thin"}, headers=auth)
    assert response.status_code == 422
    assert "Place the project on the map" in response.json()["detail"]
    bad_question = {**FORM, "questions": [{"type": "single_choice", "prompt": "Pick"}]}
    response = client.post("/admin/projects", json=bad_question, headers=auth)
    assert "needs at least two options" in response.json()["detail"]
    backwards = {**FORM, "feedback_closes": "2026-10-01"}
    assert client.post("/admin/drafts", json=backwards, headers=auth).status_code == 422
    missing_doc = {**FORM, "document_ids": ["nope"]}
    assert (
        client.post("/admin/projects", json=missing_doc, headers=auth).status_code
        == 422
    )
    response = client.post(
        "/admin/uploads",
        files={"file": ("run.exe", b"MZ", "application/x-msdownload")},
        headers=auth,
    )
    assert response.status_code == 415
    assert client.get("/events").json() == []


APP_EVENT = {
    "title": "Street party",
    "description": "Posted from the app.",
    "latitude": 50.91,
    "longitude": -1.4,
    "closes_at": "2026-11-01T17:00:00Z",
}


def test_admins_add_edit_and_remove_what_the_app_shows(client, auth):
    for method, url in (
        ("GET", "/admin/events"),
        ("POST", "/admin/events"),
        ("PUT", "/admin/events/1"),
        ("DELETE", "/admin/events/1"),
        ("DELETE", "/admin/comments/1"),
    ):
        assert client.request(method, url, json=APP_EVENT).status_code == 401, url

    response = client.post("/admin/events", json=APP_EVENT, headers=auth)
    assert response.status_code == 201
    created = response.json()
    assert created == {"id": 1, "likes": 0, "dislikes": 0, "comments": 0, **APP_EVENT}
    # Exactly what the app reads
    (event,) = client.get("/events").json()
    assert {k: event[k] for k in APP_EVENT} == APP_EVENT

    client.put("/events/1/vote", json={"vote": 1})
    comment = client.post("/events/1/comments", json={"body": "Rude words"}).json()
    moved = {**APP_EVENT, "title": "Street party (moved)", "latitude": 50.92}
    response = client.put("/admin/events/1", json=moved, headers=auth)
    assert response.json() == {
        "id": 1,
        "likes": 1,
        "dislikes": 0,
        "comments": 1,
        **moved,
    }
    assert client.get("/events/1").json()["title"] == "Street party (moved)"
    assert client.get("/admin/events", headers=auth).json() == [response.json()]
    bad = {**moved, "closes_at": "2026-11-01T17:00:00"}  # no timezone
    assert client.put("/admin/events/1", json=bad, headers=auth).status_code == 422
    assert client.put("/admin/events/9", json=moved, headers=auth).status_code == 404

    # Moderators can remove anyone's comment, unlike residents
    assert client.delete(f"/events/1/comments/{comment['id']}").status_code == 204
    comment = client.post("/events/1/comments", json={"body": "Again"}).json()
    with TestClient(client.app) as stranger:
        assert stranger.delete(f"/events/1/comments/{comment['id']}").status_code == 403
    url = f"/admin/comments/{comment['id']}"
    assert client.delete(url, headers=auth).status_code == 204
    assert client.delete(url, headers=auth).status_code == 404
    assert client.get("/events/1/comments").json() == []

    assert client.delete("/admin/events/1", headers=auth).status_code == 204
    assert client.get("/events").json() == []
    assert client.delete("/admin/events/1", headers=auth).status_code == 404


def test_overview_counts_app_data(client, auth):
    client.post("/admin/events", json=APP_EVENT, headers=auth)
    client.post(
        "/admin/events",
        json={**APP_EVENT, "title": "Old fair", "closes_at": "2020-01-01T12:00:00Z"},
        headers=auth,
    )
    client.put("/events/1/vote", json={"vote": -1})
    client.post("/events/2/comments", json={"body": "Missed it"})
    overview = client.get("/admin/overview", headers=auth).json()
    assert overview["stats"] == {
        "events": 2,
        "open_events": 1,
        "comments": 1,
        "likes": 0,
        "dislikes": 1,
        "residents": 1,  # the admin account isn't a resident
    }
    (comment,) = overview["recent_comments"]
    assert comment["event_title"] == "Old fair"
    assert comment["body"] == "Missed it"


def test_change_signature_tracks_everything_the_app_shows(client, auth):
    path = client.app.state.database_path

    def signature():
        with connect(path) as database:
            return live.change_signature(database)

    seen = [signature()]
    assert signature() == seen[0]
    for method, url, body in (
        ("POST", "/admin/events", APP_EVENT),
        ("PUT", "/events/1/vote", {"vote": 1}),
        ("POST", "/events/1/comments", {"body": "Love it"}),
        ("PUT", "/admin/events/1", {**APP_EVENT, "title": "Renamed only"}),
        ("DELETE", "/admin/comments/1", None),
        ("DELETE", "/admin/events/1", None),
    ):
        client.request(method, url, json=body, headers=auth)
        assert signature() not in seen, url
        seen.append(signature())


def test_change_stream_needs_admin_and_sends_current_version(client, auth, monkeypatch):
    monkeypatch.setattr(live, "STREAM_SECONDS", 0)  # TestClient reads the whole body
    assert client.get("/admin/stream").status_code == 401
    bad = {"Authorization": "Bearer not-a-token"}
    assert client.get("/admin/stream", headers=bad).status_code == 401
    with client.stream("GET", "/admin/stream", headers=auth) as response:
        assert response.status_code == 200
        assert response.headers["content-type"].startswith("text/event-stream")
        lines = response.iter_lines()
        assert next(lines) == "event: change"
        assert next(lines).startswith('data: {"version": ')


def test_feedback_deadline_follows_uk_time():
    assert feedback_deadline(date(2026, 7, 1)) == "2026-07-01T22:59:59+00:00"
    assert feedback_deadline(date(2026, 12, 1)) == "2026-12-01T23:59:59+00:00"
    # Clocks go forward on 29 March 2026 and back on 25 October 2026
    assert feedback_deadline(date(2026, 3, 28)).startswith("2026-03-28T23")
    assert feedback_deadline(date(2026, 3, 29)).startswith("2026-03-29T22")
    assert feedback_deadline(date(2026, 10, 24)).startswith("2026-10-24T22")
    assert feedback_deadline(date(2026, 10, 25)).startswith("2026-10-25T23")


def test_app_version_changes_when_the_admin_adds_a_pin(client, auth):
    before = client.get("/events/version")
    assert before.status_code == 200
    assert client.get("/events/version").json() == before.json()
    client.post("/admin/events", json=APP_EVENT, headers=auth)
    assert client.get("/events/version").json() != before.json()


def test_existing_projects_get_their_app_deadline(client, auth):
    client.post("/admin/projects", json=FORM, headers=auth)
    path = client.app.state.database_path
    with connect(path) as database:
        database.execute("UPDATE events SET closes_at = NULL")
    initialize(path)
    assert client.get("/events/1").json()["closes_at"] == "2026-12-01T23:59:59Z"


def test_website_replies_and_mobile_notifications(client, auth):
    event = client.post(
        "/admin/events",
        headers=auth,
        json={
            "title": "Library",
            "description": "New study space",
            "latitude": 50.9,
            "longitude": -1.4,
            "closes_at": "2026-12-01T17:00:00Z",
        },
    ).json()
    event_id = event["id"]
    resident = ("resident@example.com", "resident-password")
    parent = client.post(
        f"/events/{event_id}/comments", auth=resident, json={"body": "Please add desks"}
    ).json()
    url = f"/admin/events/{event_id}/comments"
    assert client.get(url).status_code == 401
    assert client.post(url, json={"body": "Unauthorized"}).status_code == 401
    reply = client.post(
        url, headers=auth, json={"body": "We can do that", "parent_id": parent["id"]}
    )
    assert reply.status_code == 201
    reply = reply.json()
    assert reply["user_email"] == ADMIN["identifier"]
    assert reply["is_mine"] is True
    assert reply["parent_id"] == parent["id"]
    assert client.get(url, headers=auth).json()[-1]["is_mine"] is True
    notice = client.get("/users/me/notifications", auth=resident).json()[0]
    assert notice["body"] == "We can do that"
    assert notice["user_email"] == ADMIN["identifier"]
    assert client.get("/admin/notifications", headers=auth).json() == []
    client.post(
        f"/events/{event_id}/comments",
        auth=resident,
        json={"body": "Thanks!", "parent_id": reply["id"]},
    )
    notices = client.get("/admin/notifications", headers=auth).json()
    assert len(notices) == 1
    assert notices[0]["body"] == "Thanks!"
    assert notices[0]["is_read"] is False
    read_url = f"/admin/notifications/{notices[0]['id']}/read"
    assert client.patch(read_url).status_code == 401
    assert client.patch(read_url, headers=auth).status_code == 200
    assert client.get("/admin/notifications", headers=auth).json()[0]["is_read"] is True
    # Another staff account cannot see or mark this staff member's notifications.
    with connect(client.app.state.database_path) as database:
        database.execute(
            "INSERT INTO admins (email, name) VALUES (?, ?)",
            (resident[0], "Other officer"),
        )
    other = client.post(
        "/auth/login", json={"identifier": resident[0], "password": resident[1]}
    ).json()["access_token"]
    other_auth = {"Authorization": f"Bearer {other}"}
    assert all(
        item["id"] != notices[0]["id"]
        for item in client.get("/admin/notifications", headers=other_auth).json()
    )
    assert client.patch(read_url, headers=other_auth).status_code == 404
    client.delete(f"/admin/comments/{reply['id']}", headers=auth)
    assert client.get("/users/me/notifications", auth=resident).json() == []


def test_website_replies_respect_project_settings(client, auth):
    form = {**FORM, "engagement": {**FORM["engagement"], "comment_replies": False}}
    published = client.post("/admin/projects", headers=auth, json=form)
    assert published.status_code == 201
    event_id = published.json()["event_id"]
    parent = client.post(f"/events/{event_id}/comments", json={"body": "Hello"}).json()
    response = client.post(
        f"/admin/events/{event_id}/comments",
        headers=auth,
        json={"body": "Reply", "parent_id": parent["id"]},
    )
    assert response.status_code == 403
