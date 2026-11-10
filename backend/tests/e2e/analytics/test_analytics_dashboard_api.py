import pytest
from datetime import datetime, timezone


def _register(client, email="ana@example.com"):
    response = client.post(
        "/api/auth/register", json={"email": email, "password": "supersecret123", "display_name": "Ana"}
    )
    # Registrado "hace años": estos tests usan fechas pasadas y el análisis ignora lo
    # anterior al registro del usuario.
    from sqlalchemy import update

    from app.modules.auth import User
    from conftest import TestSessionLocal

    with TestSessionLocal() as session:
        session.execute(update(User).where(User.email == email).values(created_at=datetime(2020, 1, 1, tzinfo=timezone.utc)))
        session.commit()
    return response.json()["access_token"]


def _headers(token):
    return {"Authorization": f"Bearer {token}"}


def _wallet(client, token):
    return client.post("/api/wallets", json={"name": "Cash", "currency": "USD"}, headers=_headers(token)).json()


def _expense(client, token, wallet_id, amount, category, when):
    payload = {
        "wallet_id": wallet_id,
        "type": "expense",
        "amount": str(amount),
        "category": category,
        "occurred_at": when.isoformat(),
    }
    assert client.post("/api/transactions", json=payload, headers=_headers(token)).status_code == 201


PROTECTED = [
    "/api/analytics/timeline?granularity=day&date_from=2026-11-01&date_to=2026-11-02",
    "/api/analytics/compare",
    "/api/analytics/patterns",
    "/api/analytics/wallets",
    "/api/analytics/top-transactions",
    "/api/analytics/insights",
]


@pytest.mark.parametrize("url", PROTECTED)
def test_dashboard_endpoints_require_auth(client, url):
    assert client.get(url).status_code == 401


def test_timeline_returns_one_bucket_per_day_with_zeros(client):
    token = _register(client)
    wallet = _wallet(client, token)
    _expense(client, token, wallet["id"], "40.00", "Mercado", datetime(2026, 11, 2, 12, tzinfo=timezone.utc))

    response = client.get(
        "/api/analytics/timeline",
        params={"granularity": "day", "date_from": "2026-11-01", "date_to": "2026-11-03"},
        headers=_headers(token),
    )

    assert response.status_code == 200
    body = response.json()
    assert body["granularity"] == "day"
    assert [bucket["start"] for bucket in body["buckets"]] == ["2026-11-01", "2026-11-02", "2026-11-03"]
    assert [float(bucket["total_expense"]) for bucket in body["buckets"]] == [0, 40, 0]


def test_timeline_rejects_inverted_range_and_unknown_granularity(client):
    token = _register(client)

    inverted = client.get(
        "/api/analytics/timeline",
        params={"granularity": "day", "date_from": "2026-11-05", "date_to": "2026-11-01"},
        headers=_headers(token),
    )
    unknown = client.get(
        "/api/analytics/timeline",
        params={"granularity": "hour", "date_from": "2026-11-01", "date_to": "2026-11-05"},
        headers=_headers(token),
    )

    assert inverted.status_code == 422
    assert unknown.status_code == 422


def test_compare_returns_categories_and_validates_against(client):
    token = _register(client)
    wallet = _wallet(client, token)
    _expense(client, token, wallet["id"], "100.00", "Mercado", datetime(2026, 10, 2, 12, tzinfo=timezone.utc))
    _expense(client, token, wallet["id"], "150.00", "Mercado", datetime(2026, 11, 1, 12, tzinfo=timezone.utc))

    ok = client.get("/api/analytics/compare", params={"month": "2026-10", "against": "previous"}, headers=_headers(token))
    bad = client.get("/api/analytics/compare", params={"against": "nope"}, headers=_headers(token))

    assert ok.status_code == 200
    assert ok.json()["period"] == "2026-10"
    assert ok.json()["categories"][0]["category"] == "Mercado"
    assert bad.status_code == 422


def test_wallets_top_transactions_patterns_and_insights_respond(client):
    token = _register(client)
    wallet = _wallet(client, token)
    now = datetime.now(timezone.utc)
    _expense(client, token, wallet["id"], "25.00", "Mercado", now)
    month = f"{now.year:04d}-{now.month:02d}"

    wallets = client.get("/api/analytics/wallets", params={"month": month}, headers=_headers(token))
    top = client.get("/api/analytics/top-transactions", params={"month": month, "limit": 3}, headers=_headers(token))
    patterns = client.get("/api/analytics/patterns", headers=_headers(token))
    insights = client.get("/api/analytics/insights", headers=_headers(token))

    assert wallets.json()[0]["name"] == "Cash"
    assert float(top.json()[0]["amount"]) == 25
    assert len(patterns.json()["weekday_averages"]) == 7
    assert insights.json()[0]["code"] == "not_enough_history"


def test_top_transactions_limit_is_bounded(client):
    token = _register(client)

    response = client.get("/api/analytics/top-transactions", params={"limit": 500}, headers=_headers(token))

    assert response.status_code == 422
