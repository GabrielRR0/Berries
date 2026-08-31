from datetime import datetime, timezone
from decimal import Decimal

import pytest

from app.core.rate_limit import limiter
from app.main import app
from app.routers.analytics.analytics_router import router as analytics_router
from app.routers.transactions.transactions_router import router as transactions_router
from app.routers.wallets.wallets_router import router as wallets_router

# app/main.py todavía no incluye estos routers (lo cablea otro proceso más adelante) — se
# montan acá, sobre el mismo `app` compartido que usa el fixture `client` de conftest.py,
# para poder probar el router real de punta a punta sin tocar el archivo main.py. Se montan
# también wallets/transactions porque estos tests fondean datos vía HTTP.
if not any(getattr(route, "path", "").startswith("/api/wallets") for route in app.routes):
    app.include_router(wallets_router, prefix="/api/wallets", tags=["wallets"])
if not any(getattr(route, "path", "").startswith("/api/transactions") for route in app.routes):
    app.include_router(transactions_router, prefix="/api/transactions", tags=["transactions"])
if not any(getattr(route, "path", "").startswith("/api/analytics") for route in app.routes):
    app.include_router(analytics_router, prefix="/api/analytics", tags=["analytics"])


@pytest.fixture(autouse=True)
def _reset_rate_limiter():
    # Ver comentario equivalente en tests/routers/wallets/test_wallets_router.py: el
    # limiter de /api/auth/register no se resetea solo entre tests.
    limiter.reset()
    yield


def _register(client, email="ana@example.com"):
    response = client.post(
        "/api/auth/register", json={"email": email, "password": "supersecret123", "display_name": "Ana"}
    )
    return response.json()["access_token"]


def _auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


def _create_wallet(client, token, name="Cash", currency="USD"):
    return client.post("/api/wallets", json={"name": name, "currency": currency}, headers=_auth_headers(token)).json()


def _create_transaction(client, token, wallet_id, type_, amount, category, occurred_at):
    payload = {
        "wallet_id": wallet_id,
        "type": type_,
        "amount": str(amount),
        "category": category,
        "occurred_at": occurred_at.isoformat(),
    }
    response = client.post("/api/transactions", json=payload, headers=_auth_headers(token))
    assert response.status_code == 201, response.text
    return response.json()


def _dt(year, month, day=15):
    return datetime(year, month, day, tzinfo=timezone.utc)


# --- GET /api/analytics/summary -----------------------------------------------------


def test_summary_requires_auth(client):
    response = client.get("/api/analytics/summary")

    assert response.status_code == 401


def test_summary_returns_totals_and_previous_period_net_savings(client):
    token = _register(client)
    wallet = _create_wallet(client, token)
    # Mayo: net = 500
    _create_transaction(client, token, wallet["id"], "income", "800.00", "Salario", _dt(2024, 5, 1))
    _create_transaction(client, token, wallet["id"], "expense", "300.00", "Renta", _dt(2024, 5, 10))
    # Junio: net = 150
    _create_transaction(client, token, wallet["id"], "income", "200.00", "Salario", _dt(2024, 6, 1))
    _create_transaction(client, token, wallet["id"], "expense", "50.00", "Comida", _dt(2024, 6, 10))

    response = client.get("/api/analytics/summary", params={"month": "2024-06"}, headers=_auth_headers(token))

    assert response.status_code == 200
    body = response.json()
    assert body["period"] == "2024-06"
    assert Decimal(body["total_income"]) == Decimal("200.00")
    assert Decimal(body["total_expense"]) == Decimal("50.00")
    assert Decimal(body["net_savings"]) == Decimal("150.00")
    assert Decimal(body["previous_period_net_savings"]) == Decimal("500.00")


def test_summary_month_with_zero_transactions_returns_all_zeros(client):
    token = _register(client)
    _create_wallet(client, token)

    response = client.get("/api/analytics/summary", params={"month": "2030-01"}, headers=_auth_headers(token))

    assert response.status_code == 200
    body = response.json()
    assert Decimal(body["total_income"]) == Decimal("0")
    assert Decimal(body["total_expense"]) == Decimal("0")
    assert Decimal(body["net_savings"]) == Decimal("0")


def test_summary_defaults_to_current_month_when_no_query_param(client):
    token = _register(client)
    now = datetime.now(timezone.utc)

    response = client.get("/api/analytics/summary", headers=_auth_headers(token))

    assert response.status_code == 200
    assert response.json()["period"] == f"{now.year:04d}-{now.month:02d}"


def test_summary_isolates_transactions_between_users(client):
    token_a = _register(client, "a@example.com")
    token_b = _register(client, "b@example.com")
    wallet_a = _create_wallet(client, token_a)
    wallet_b = _create_wallet(client, token_b, "Banco")
    _create_transaction(client, token_a, wallet_a["id"], "income", "100.00", "Salario", _dt(2024, 3, 1))
    _create_transaction(client, token_b, wallet_b["id"], "income", "9999.00", "Salario", _dt(2024, 3, 1))

    response = client.get("/api/analytics/summary", params={"month": "2024-03"}, headers=_auth_headers(token_a))

    assert Decimal(response.json()["total_income"]) == Decimal("100.00")


# --- GET /api/analytics/categories ---------------------------------------------------


def test_categories_requires_auth(client):
    response = client.get("/api/analytics/categories", params={"type": "expense"})

    assert response.status_code == 401


def test_categories_requires_type_param(client):
    token = _register(client)

    response = client.get("/api/analytics/categories", headers=_auth_headers(token))

    assert response.status_code == 422


def test_categories_percentages_sum_to_100_and_sorted_descending(client):
    token = _register(client)
    wallet = _create_wallet(client, token)
    _create_transaction(client, token, wallet["id"], "expense", "100.00", "Comida", _dt(2024, 7, 1))
    _create_transaction(client, token, wallet["id"], "expense", "50.00", "Transporte", _dt(2024, 7, 2))
    _create_transaction(client, token, wallet["id"], "expense", "25.00", "Comida", _dt(2024, 7, 3))

    response = client.get(
        "/api/analytics/categories", params={"type": "expense", "month": "2024-07"}, headers=_auth_headers(token)
    )

    assert response.status_code == 200
    body = response.json()
    assert [item["category"] for item in body] == ["Comida", "Transporte"]
    assert abs(sum(item["percentage"] for item in body) - 100.0) < 0.01


def test_categories_with_no_transactions_of_that_type_returns_empty_list_not_500(client):
    token = _register(client)
    wallet = _create_wallet(client, token)
    _create_transaction(client, token, wallet["id"], "expense", "100.00", "Comida", _dt(2024, 7, 1))

    response = client.get(
        "/api/analytics/categories", params={"type": "income", "month": "2024-07"}, headers=_auth_headers(token)
    )

    assert response.status_code == 200
    assert response.json() == []


def test_categories_isolates_transactions_between_users(client):
    token_a = _register(client, "a@example.com")
    token_b = _register(client, "b@example.com")
    wallet_a = _create_wallet(client, token_a)
    wallet_b = _create_wallet(client, token_b, "Banco")
    _create_transaction(client, token_a, wallet_a["id"], "expense", "10.00", "Comida", _dt(2024, 7, 1))
    _create_transaction(client, token_b, wallet_b["id"], "expense", "999.00", "Comida", _dt(2024, 7, 1))

    response = client.get(
        "/api/analytics/categories", params={"type": "expense", "month": "2024-07"}, headers=_auth_headers(token_a)
    )

    body = response.json()
    assert len(body) == 1
    assert Decimal(body[0]["total"]) == Decimal("10.00")


# --- GET /api/analytics/monthly ------------------------------------------------------


def test_monthly_requires_auth(client):
    response = client.get("/api/analytics/monthly")

    assert response.status_code == 401


def test_monthly_returns_default_6_months_ending_in_current_month(client):
    token = _register(client)
    _create_wallet(client, token)
    now = datetime.now(timezone.utc)

    response = client.get("/api/analytics/monthly", headers=_auth_headers(token))

    assert response.status_code == 200
    body = response.json()
    assert len(body) == 6
    assert body[-1]["month"] == f"{now.year:04d}-{now.month:02d}"


def test_monthly_respects_months_query_param_and_includes_gap_month(client):
    token = _register(client)
    wallet = _create_wallet(client, token)
    now = datetime.now(timezone.utc)

    response = client.get("/api/analytics/monthly", params={"months": 3}, headers=_auth_headers(token))

    assert response.status_code == 200
    body = response.json()
    assert len(body) == 3
    # El mes del medio (now - 1) no tiene transacciones: debe seguir apareciendo en cero.
    middle = body[1]
    assert Decimal(middle["total_income"]) == Decimal("0")
    assert Decimal(middle["total_expense"]) == Decimal("0")
    assert Decimal(middle["net"]) == Decimal("0")


def test_monthly_isolates_transactions_between_users(client):
    token_a = _register(client, "a@example.com")
    token_b = _register(client, "b@example.com")
    wallet_a = _create_wallet(client, token_a)
    wallet_b = _create_wallet(client, token_b, "Banco")
    now = datetime.now(timezone.utc)
    _create_transaction(client, token_a, wallet_a["id"], "income", "10.00", "Salario", now)
    _create_transaction(client, token_b, wallet_b["id"], "income", "9999.00", "Salario", now)

    response = client.get("/api/analytics/monthly", params={"months": 1}, headers=_auth_headers(token_a))

    body = response.json()
    assert len(body) == 1
    assert Decimal(body[0]["total_income"]) == Decimal("10.00")
