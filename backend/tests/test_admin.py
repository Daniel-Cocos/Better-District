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
    with TestClient(
        create_app(tmp_path / "test.db", background_jobs=False)
    ) as test_client:
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
        "flagged_comments": 0,
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


def test_flagged_comments_leave_the_app_until_an_admin_decides(client, auth):
    client.post("/admin/events", json=APP_EVENT, headers=auth)
    resident = ("resident@example.com", "resident-password")
    rude = client.post(
        "/events/1/comments", auth=resident, json={"body": "Rude words"}
    ).json()
    reply = client.post(
        "/admin/events/1/comments",
        headers=auth,
        json={"body": "Please keep it civil", "parent_id": rude["id"]},
    ).json()
    flag_url = f"/events/1/comments/{rude['id']}/flag"
    assert client.post(flag_url, auth=resident, json={}).status_code == 403
    assert client.post("/events/1/comments/99/flag", json={}).status_code == 404

    # One report hides it from everyone in the app, but not from the website
    with TestClient(client.app) as reporter:
        assert reporter.post(flag_url, json={"reason": "Abusive"}).status_code == 204
        assert reporter.post(flag_url, json={"reason": "Again"}).status_code == 204
    with TestClient(client.app) as other:
        assert other.post(flag_url, json={}).status_code == 204
    assert [c["id"] for c in client.get("/events/1/comments").json()] == [reply["id"]]
    vote_url = f"/events/1/comments/{rude['id']}/vote"
    assert client.put(vote_url, json={"vote": 1}).status_code == 404
    reply_body = {"body": "Agreed", "parent_id": rude["id"]}
    assert client.post("/events/1/comments", json=reply_body).status_code == 404
    (mine,) = client.get("/users/me/comments", auth=resident).json()
    assert mine["under_review"] is True
    admin_view = client.get("/admin/events/1/comments", headers=auth).json()
    assert [c["under_review"] for c in admin_view] == [True, False]
    overview = client.get("/admin/overview", headers=auth).json()
    assert overview["stats"]["flagged_comments"] == 1

    (flagged,) = client.get("/admin/flagged-comments", headers=auth).json()
    assert flagged["id"] == rude["id"]
    assert flagged["event_title"] == APP_EVENT["title"]
    assert flagged["flags"] == 2
    assert flagged["reasons"] == ["Abusive"]
    assert client.get("/admin/flagged-comments").status_code == 401

    # Keeping it puts it back, and it can't be flagged again until edited
    approve_url = f"/admin/comments/{rude['id']}/approve"
    assert client.post(approve_url).status_code == 401
    assert client.post(approve_url, headers=auth).status_code == 204
    assert client.post("/admin/comments/99/approve", headers=auth).status_code == 404
    assert client.get("/admin/flagged-comments", headers=auth).json() == []
    assert len(client.get("/events/1/comments").json()) == 2
    assert client.post(flag_url, json={}).status_code == 409
    client.patch(
        f"/events/1/comments/{rude['id']}", auth=resident, json={"body": "Ruder"}
    )
    assert client.post(flag_url, json={}).status_code == 204

    # Removing it deletes it for good
    assert (
        client.delete(f"/admin/comments/{rude['id']}", headers=auth).status_code == 204
    )
    assert client.get("/admin/flagged-comments", headers=auth).json() == []


def test_flagged_replies_drop_out_of_notifications(client, auth):
    client.post("/admin/events", json=APP_EVENT, headers=auth)
    resident = ("resident@example.com", "resident-password")
    parent = client.post(
        "/events/1/comments", auth=resident, json={"body": "Hello"}
    ).json()
    reply = client.post(
        "/events/1/comments", json={"body": "Nasty", "parent_id": parent["id"]}
    ).json()
    assert len(client.get("/users/me/notifications", auth=resident).json()) == 1
    client.post(f"/events/1/comments/{reply['id']}/flag", auth=resident, json={})
    assert client.get("/users/me/notifications", auth=resident).json() == []
    client.post(f"/admin/comments/{reply['id']}/approve", headers=auth)
    assert len(client.get("/users/me/notifications", auth=resident).json()) == 1


def test_feedback_summary_combines_votes_and_cached_model_analysis(
    client, auth, monkeypatch
):
    from app import feedback

    calls = []

    def fake_model(model, prompt):
        calls.append(prompt)
        return {
            "summary": "Most residents back the party but worry about noise.",
            "comments": [
                {"n": 1, "type": "support"},
                {"n": 2, "type": "oppose"},
                {"n": 3, "type": "support"},
                {"n": 3, "type": "oppose"},  # duplicate label: first one wins
                {"n": 9, "type": "support"},  # no such comment
                {"n": 4, "type": "nonsense"},
            ],
            "themes": [
                {"label": "Noise", "sentiment": "negative", "comments": [2, 2, 9]},
                {"label": "Community", "sentiment": "positive", "comments": [1, 3]},
                {"label": "Empty", "sentiment": "positive", "comments": []},
            ],
        }

    monkeypatch.setattr(feedback, "pick_model", lambda: "test-model")
    monkeypatch.setattr(feedback, "ask_model", fake_model)
    client.post("/admin/events", json=APP_EVENT, headers=auth)
    url = "/admin/events/1/feedback"
    assert client.get(url).status_code == 401
    assert client.post(f"{url}/analyse").status_code == 401
    assert client.get("/admin/events/9/feedback", headers=auth).status_code == 404

    empty = client.get(url, headers=auth).json()
    assert empty["approval"] is None and empty["analysis"] is None
    assert client.post(f"{url}/analyse", headers=auth).json()["analysis"] is None
    assert calls == []  # nothing to analyse

    resident = ("resident@example.com", "resident-password")
    client.put("/events/1/vote", json={"vote": 1})
    client.put("/events/1/vote", auth=resident, json={"vote": -1})
    with TestClient(client.app) as third:
        third.put("/events/1/vote", json={"vote": 1})
    for body in ("Great idea", "Too loud", "Love it", "When does it start?"):
        client.post("/events/1/comments", auth=resident, json={"body": body})
    client.put("/events/1/comments/1/vote", json={"vote": 1})
    hidden = client.post("/events/1/comments", json={"body": "Spam"}).json()
    client.post(f"/events/1/comments/{hidden['id']}/flag", auth=resident, json={})

    before = client.get(url, headers=auth).json()
    assert before["likes"] == 2 and before["dislikes"] == 1
    assert before["approval"] == pytest.approx(2 / 3)
    assert before["comments"] == 4  # the flagged one is left out
    assert before["comment_likes"] == 1
    assert before["analysis"] is None

    analysis = client.post(f"{url}/analyse", headers=auth).json()["analysis"]
    assert "Spam" not in calls[0] and "Great idea" in calls[0]
    assert analysis["summary"].startswith("Most residents")
    assert analysis["model"] == "test-model"
    assert analysis["types"] == [
        {"type": "support", "count": 2, "likes": 1},
        {"type": "oppose", "count": 1, "likes": 0},
    ]
    assert analysis["classified"] == 3 and analysis["analysed"] == 4
    assert analysis["themes"] == [
        {"label": "Community", "sentiment": "positive", "count": 2},
        {"label": "Noise", "sentiment": "negative", "count": 1},
    ]
    assert analysis["stale"] is False

    # Cached until the comments change; votes alone don't trigger a new run
    client.put("/events/1/comments/2/vote", json={"vote": -1})
    client.post(f"{url}/analyse", headers=auth)
    assert len(calls) == 1
    client.post("/events/1/comments", json={"body": "Another view"})
    assert client.get(url, headers=auth).json()["analysis"]["stale"] is True
    client.post(f"{url}/analyse", headers=auth)
    assert len(calls) == 2
    client.post(f"{url}/analyse?force=true", headers=auth)
    assert len(calls) == 3


def test_feedback_reports_an_unreachable_model_server(client, auth, monkeypatch):
    from app import feedback

    monkeypatch.setattr(feedback, "OLLAMA_URL", "http://127.0.0.1:9")
    monkeypatch.setattr(feedback, "OLLAMA_MODEL", "")
    client.post("/admin/events", json=APP_EVENT, headers=auth)
    client.post("/events/1/comments", json={"body": "Hello"})
    response = client.post("/admin/events/1/feedback/analyse", headers=auth)
    assert response.status_code == 503
    assert "127.0.0.1:9" in response.json()["detail"]
    # The vote numbers still work without the model
    assert client.get("/admin/events/1/feedback", headers=auth).json()["comments"] == 1


def test_feedback_never_uses_ollama_cloud_models(monkeypatch):
    from app import feedback

    tags = {
        "models": [
            {"name": "minimax-m2.7:cloud", "remote_host": "https://ollama.com:443"},
            {"name": "sneaky", "remote_host": "https://ollama.com:443"},
            {"name": "qwen3.5:9b"},
        ]
    }
    monkeypatch.setattr(feedback, "_request", lambda path, body=None: tags)
    monkeypatch.setattr(feedback, "OLLAMA_MODEL", "")
    assert feedback.pick_model() == "qwen3.5:9b"
    monkeypatch.setattr(feedback, "OLLAMA_MODEL", "minimax-m2.7:cloud")
    with pytest.raises(feedback.AnalysisUnavailable, match="cloud"):
        feedback.pick_model()
    monkeypatch.setattr(feedback, "OLLAMA_MODEL", "missing:1b")
    with pytest.raises(feedback.AnalysisUnavailable, match="isn’t installed"):
        feedback.pick_model()
    tags["models"] = tags["models"][:2]
    monkeypatch.setattr(feedback, "OLLAMA_MODEL", "")
    with pytest.raises(feedback.AnalysisUnavailable, match="No local models"):
        feedback.pick_model()


def test_insights_analyse_every_plan_then_brief_the_council(client, auth, monkeypatch):
    from app import feedback

    prompts = {"plans": [], "briefing": []}

    def fake_model(model, prompt, system=feedback.SYSTEM_PROMPT, schema=None):
        if system == feedback.BRIEFING_PROMPT:
            prompts["briefing"].append(prompt)
            return {
                "headline": "Rethink the street party; keep the library.",
                "overview": "Mixed.",
                "priorities": [
                    {"id": 1, "action": "Move it", "why": "Noise", "urgency": "high"},
                    {"id": 1, "action": "Duplicate", "why": "x", "urgency": "low"},
                    {"id": 99, "action": "Made up", "why": "x", "urgency": "high"},
                ],
                "cross_cutting": [
                    {
                        "label": "Noise",
                        "insight": "Comes up a lot",
                        "sentiment": "negative",
                        "ids": [1, 2, 99],
                    }
                ],
                "working_well": [{"id": 2, "note": "Loved"}, {"id": 42, "note": "?"}],
            }
        prompts["plans"].append(prompt)
        n = prompt.count("\nn=")
        party = "Street party" in prompt
        return {
            "summary": "Summary",
            "verdict": "rethink" if party else "on_track",
            "comments": [
                {"n": i, "type": "oppose" if party else "support"}
                for i in range(1, n + 1)
            ],
            "themes": [],
            "pivots": [
                {"action": "Low", "reason": "r", "priority": "low", "comments": [1]},
                {
                    "action": "High",
                    "reason": "r",
                    "priority": "high",
                    "comments": [1, 9],
                },
                {
                    "action": " ",
                    "reason": "dropped",
                    "priority": "high",
                    "comments": [],
                },
            ],
        }

    monkeypatch.setattr(feedback, "pick_model", lambda: "test-model")
    monkeypatch.setattr(feedback, "ask_model", fake_model)
    assert client.get("/admin/insights").status_code == 401
    assert client.post("/admin/insights/refresh").status_code == 401

    client.post("/admin/events", json=APP_EVENT, headers=auth)
    client.post(
        "/admin/events", json={**APP_EVENT, "title": "Library hours"}, headers=auth
    )
    client.post(
        "/admin/events", json={**APP_EVENT, "title": "No comments yet"}, headers=auth
    )
    for body in ("Too loud", "Not here", "Awful idea", "No", "Please don't", "Stop"):
        client.post("/events/1/comments", json={"body": body})
    client.post("/events/2/comments", json={"body": "Longer hours please"})

    before = client.get("/admin/insights", headers=auth).json()
    assert before["pending"] == 2 and before["briefing"] is None
    assert before["job"]["running"] is False
    assert [p["analysis"] for p in before["plans"]] == [None, None, None]

    response = client.post("/admin/insights/refresh", headers=auth)
    assert response.status_code == 202
    data = response.json()
    assert len(prompts["plans"]) == 2 and len(prompts["briefing"]) == 1
    assert "id=1 | Street party" in prompts["briefing"][0]
    assert data["pending"] == 0
    assert data["job"] == {
        "running": False,
        "done": 3,
        "total": 3,
        "current": None,
        "error": None,
        "failed": 0,
    }

    party, library, empty = data["plans"]
    assert party["analysis"]["verdict"] == "rethink"
    assert [p["action"] for p in party["analysis"]["pivots"]] == ["High", "Low"]
    assert party["analysis"]["pivots"][0]["count"] == 1  # comment 9 doesn't exist
    assert party["attention"]["level"] == "high"
    assert "100% of comments object or raise concerns" in party["attention"]["reasons"]
    assert library["attention"]["level"] == "low"  # one comment is too few to judge
    assert empty["analysis"] is None and empty["is_open"] is True

    totals = data["totals"]
    assert totals["plans"] == 3 and totals["analysed"] == 2
    assert totals["comments"] == 7 and totals["classified"] == 7
    assert totals["types"] == [
        {"type": "support", "count": 1, "likes": 0},
        {"type": "oppose", "count": 6, "likes": 0},
    ]
    assert totals["high_attention"] == 1

    briefing = data["briefing"]
    assert briefing["headline"].startswith("Rethink")
    assert briefing["stale"] is False and briefing["plans"] == 2
    assert briefing["priorities"] == [
        {
            "event_id": 1,
            "title": "Street party",
            "action": "Move it",
            "why": "Noise",
            "urgency": "high",
        }
    ]
    assert [e["event_id"] for e in briefing["cross_cutting"][0]["events"]] == [1, 2]
    assert briefing["working_well"] == [
        {"event_id": 2, "title": "Library hours", "note": "Loved"}
    ]

    # Nothing changed: a refresh asks the model nothing
    client.post("/admin/insights/refresh", headers=auth)
    assert len(prompts["plans"]) == 2 and len(prompts["briefing"]) == 1
    # A new comment redoes that plan and the briefing only
    client.post("/events/2/comments", json={"body": "And a café"})
    stale = client.get("/admin/insights", headers=auth).json()
    assert stale["pending"] == 1 and stale["briefing"]["stale"] is True
    client.post("/admin/insights/refresh", headers=auth)
    assert len(prompts["plans"]) == 3 and len(prompts["briefing"]) == 2
    # force redoes everything
    client.post("/admin/insights/refresh?force=true", headers=auth)
    assert len(prompts["plans"]) == 5 and len(prompts["briefing"]) == 3


def test_insights_job_reports_an_unreachable_model(client, auth, monkeypatch):
    from app import feedback

    monkeypatch.setattr(feedback, "OLLAMA_URL", "http://127.0.0.1:9")
    for title in ("One", "Two", "Three", "Four"):
        client.post("/admin/events", json={**APP_EVENT, "title": title}, headers=auth)
    for event_id in range(1, 5):
        client.post(f"/events/{event_id}/comments", json={"body": "Hi"})
    job = client.post("/admin/insights/refresh", headers=auth).json()["job"]
    assert job["running"] is False
    assert job["failed"] == 3  # gives up after three failures in a row
    assert "127.0.0.1:9" in job["error"]
