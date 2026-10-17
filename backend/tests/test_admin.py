"""Integration tests for the admin website: sign-in, drafts, uploads, and publishing."""

import pytest
from fastapi.testclient import TestClient

from app.database import connect
from app.main import create_app
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

    overview = client.get("/admin/overview", headers=auth).json()
    assert overview["stats"]["live_trials"] == 1
    (post,) = overview["posts"]
    assert post["stage"] == "live_trial"
    assert post["engagement"] == ["comments", "poll", "survey"]
    assert post["closes_on"] == "2026-12-01"


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
