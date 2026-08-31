import uuid
from decimal import Decimal

import pytest

from app.core.rate_limit import limiter
from app.main import app
from app.models.wallets.wallet_model import Wallet
from app.routers.wallets.wallets_router import router as wallets_router

# app/main.py todavía no incluye este router (lo cablea otro proceso más adelante) — se
# monta acá, sobre el mismo `app` compartido que usa el fixture `client` de conftest.py,
# para poder probar el router real de punta a punta sin tocar el archivo main.py.
if not any(getattr(route, "path", "").startswith("/api/wallets") for route in app.routes):
    app.include_router(wallets_router, prefix="/api/wallets", tags=["wallets"])


@pytest.fixture(autouse=True)
def _reset_rate_limiter():
    # El limiter de /api/auth/register es un contador en memoria que no se resetea entre
    # tests (no forma parte de la base de datos que _reset_database limpia); sin esto, los
    # numerosos registros de estos tests terminan pisando el límite de 10/minuto.
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
    return client.post("/api/wallets", json={"name": name, "currency": currency}, headers=_auth_headers(token))


def _fund_wallet(db, wallet_id, amount):
    wallet = db.get(Wallet, uuid.UUID(wallet_id))
    wallet.balance = Decimal(amount)
    db.commit()


def test_create_wallet_returns_201(client):
    token = _register(client)

    response = _create_wallet(client, token)

    assert response.status_code == 201
    body = response.json()
    assert body["name"] == "Cash"
    assert body["currency"] == "USD"
    assert Decimal(body["balance"]) == Decimal("0.00")


def test_create_wallet_accepts_an_initial_balance(client):
    token = _register(client)

    response = client.post(
        "/api/wallets",
        json={"name": "Facebank", "currency": "USD", "initial_balance": "150.50"},
        headers=_auth_headers(token),
    )

    assert response.status_code == 201
    assert Decimal(response.json()["balance"]) == Decimal("150.50")


def test_list_wallets_returns_only_mine(client):
    token_a = _register(client, "a@example.com")
    token_b = _register(client, "b@example.com")
    _create_wallet(client, token_a, "Cash", "USD")
    _create_wallet(client, token_b, "Zinli", "USD")

    response = client.get("/api/wallets", headers=_auth_headers(token_a))

    assert response.status_code == 200
    names = [w["name"] for w in response.json()]
    assert names == ["Cash"]


def test_delete_wallet_removes_it(client):
    token = _register(client)
    wallet_id = _create_wallet(client, token).json()["id"]

    delete_response = client.delete(f"/api/wallets/{wallet_id}", headers=_auth_headers(token))
    list_response = client.get("/api/wallets", headers=_auth_headers(token))

    assert delete_response.status_code == 204
    assert list_response.json() == []


def test_delete_wallet_rejects_other_users_wallet(client):
    token_a = _register(client, "a@example.com")
    token_b = _register(client, "b@example.com")
    wallet_id = _create_wallet(client, token_a).json()["id"]

    response = client.delete(f"/api/wallets/{wallet_id}", headers=_auth_headers(token_b))

    assert response.status_code == 404


def test_transfer_same_currency_happy_path(client, db):
    token = _register(client)
    cash_id = _create_wallet(client, token, "Cash", "USD").json()["id"]
    bank_id = _create_wallet(client, token, "Banco", "USD").json()["id"]
    _fund_wallet(db, cash_id, "100.00")

    response = client.post(
        "/api/wallets/transfer",
        json={"from_wallet_id": cash_id, "to_wallet_id": bank_id, "amount": "40.00"},
        headers=_auth_headers(token),
    )

    assert response.status_code == 200
    body = response.json()
    assert Decimal(body["from_wallet"]["balance"]) == Decimal("60.00")
    assert Decimal(body["to_wallet"]["balance"]) == Decimal("40.00")


def test_transfer_rejects_insufficient_balance(client, db):
    token = _register(client)
    cash_id = _create_wallet(client, token, "Cash", "USD").json()["id"]
    bank_id = _create_wallet(client, token, "Banco", "USD").json()["id"]
    _fund_wallet(db, cash_id, "10.00")

    response = client.post(
        "/api/wallets/transfer",
        json={"from_wallet_id": cash_id, "to_wallet_id": bank_id, "amount": "40.00"},
        headers=_auth_headers(token),
    )

    assert response.status_code == 400


def test_transfer_cross_currency_without_converted_amount_is_rejected(client, db):
    token = _register(client)
    cash_id = _create_wallet(client, token, "Cash", "USD").json()["id"]
    bank_id = _create_wallet(client, token, "Banco", "VEF").json()["id"]
    _fund_wallet(db, cash_id, "100.00")

    response = client.post(
        "/api/wallets/transfer",
        json={"from_wallet_id": cash_id, "to_wallet_id": bank_id, "amount": "10.00"},
        headers=_auth_headers(token),
    )

    assert response.status_code == 400


def test_transfer_rejects_wallet_belonging_to_another_user(client, db):
    token_a = _register(client, "a@example.com")
    token_b = _register(client, "b@example.com")
    cash_id = _create_wallet(client, token_a, "Cash", "USD").json()["id"]
    bank_id = _create_wallet(client, token_b, "Banco", "USD").json()["id"]
    _fund_wallet(db, cash_id, "100.00")

    response = client.post(
        "/api/wallets/transfer",
        json={"from_wallet_id": cash_id, "to_wallet_id": bank_id, "amount": "10.00"},
        headers=_auth_headers(token_a),
    )

    assert response.status_code == 404


def test_wallet_endpoints_require_auth(client):
    response = client.get("/api/wallets")

    assert response.status_code == 401
