"""Exercise CRUD, persistence, and invalid requests against temporary SQLite files."""

from fastapi.testclient import TestClient

from app.main import create_app


def test_crud_and_persistence(tmp_path):
    database = tmp_path / "test.db"
    with TestClient(create_app(database)) as client:
        assert client.get("/health").json() == {"status": "ok"}
        assert client.get("/items").json() == []
        response = client.post("/items", json={"name": "First item"})
        assert response.status_code == 201
        item = response.json()
        item_url = f"/items/{item['id']}"
        assert client.get(item_url).json() == item
        assert client.get("/items").json() == [item]
        assert client.get("/items?offset=1").json() == []
        updated = {"name": "Updated", "description": "Saved to SQLite"}
        response = client.put(item_url, json=updated)
        assert response.status_code == 200
        assert response.json() == {"id": item["id"], **updated}

    with TestClient(create_app(database)) as client:
        assert client.get(item_url).json() == {"id": item["id"], **updated}
        assert client.delete(item_url).status_code == 204
        assert client.get(item_url).status_code == 404
        assert client.put(item_url, json=updated).status_code == 404
        assert client.delete(item_url).status_code == 404
        assert client.get("/items").json() == []


def test_validation(tmp_path):
    with TestClient(create_app(tmp_path / "test.db")) as client:
        for payload in ({}, {"name": ""}, {"name": "   "}):
            assert client.post("/items", json=payload).status_code == 422
        assert client.get("/items?limit=101").status_code == 422
        assert client.get("/items?offset=-1").status_code == 422
