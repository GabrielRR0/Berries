import uuid
from datetime import date, timedelta


def _register(client, email="ana@example.com"):
    response = client.post(
        "/api/auth/register", json={"email": email, "password": "supersecret123", "display_name": "Ana"}
    )
    return response.json()["access_token"]


def _auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


_FUTURE = (date.today() + timedelta(days=90)).isoformat()


def test_get_one_returns_the_goal(client):
    token = _register(client)
    created = client.post(
        "/api/goals",
        json={"title": "MacBook", "target_amount": "1200", "currency": "USD", "target_date": _FUTURE, "goal_type": "computer"},
        headers=_auth_headers(token),
    )
    goal_id = created.json()["id"]

    response = client.get(f"/api/goals/{goal_id}", headers=_auth_headers(token))

    assert response.status_code == 200
    body = response.json()
    assert body["title"] == "MacBook"
    assert body["goal_type"] == "computer"


def test_get_one_rejects_unknown_id(client):
    token = _register(client)

    response = client.get(f"/api/goals/{uuid.uuid4()}", headers=_auth_headers(token))

    assert response.status_code == 404


def test_get_one_rejects_someone_elses_goal(client):
    token_a = _register(client, "a@example.com")
    token_b = _register(client, "b@example.com")
    created = client.post(
        "/api/goals",
        json={"title": "MacBook", "target_amount": "1200", "currency": "USD", "target_date": _FUTURE, "goal_type": "computer"},
        headers=_auth_headers(token_a),
    )
    goal_id = created.json()["id"]

    response = client.get(f"/api/goals/{goal_id}", headers=_auth_headers(token_b))

    assert response.status_code == 404


def test_get_one_does_not_shadow_static_routes(client):
    token = _register(client)

    assert client.get("/api/goals/summary", headers=_auth_headers(token)).status_code == 200
    assert client.get("/api/goals/savings-capacity", headers=_auth_headers(token)).status_code == 200
    assert client.get("/api/goals/pending-check-ins", headers=_auth_headers(token)).status_code == 200


def test_get_one_requires_auth(client):
    response = client.get(f"/api/goals/{uuid.uuid4()}")

    assert response.status_code in (401, 403)
