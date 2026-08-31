import uuid
from decimal import Decimal

import pytest

from app.core.rate_limit import limiter
from app.main import app
from app.models.wallets.wallet_model import Wallet
from app.routers.transactions.transactions_router import router as transactions_router
from app.routers.wallets.wallets_router import router as wallets_router
from app.services.transactions.drafts.draft_review_service import create_draft

# app/main.py todavía no incluye estos routers (lo cablea otro proceso más adelante) — se
# montan acá, sobre el mismo `app` compartido que usa el fixture `client` de conftest.py,
# para poder probar el router real de punta a punta sin tocar el archivo main.py. Se monta
# también wallets_router porque estos tests crean wallets vía HTTP para fondear pruebas.
if not any(getattr(route, "path", "").startswith("/api/wallets") for route in app.routes):
    app.include_router(wallets_router, prefix="/api/wallets", tags=["wallets"])
if not any(getattr(route, "path", "").startswith("/api/transactions") for route in app.routes):
    app.include_router(transactions_router, prefix="/api/transactions", tags=["transactions"])


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


def _fund_wallet(db, wallet_id, amount):
    wallet = db.get(Wallet, uuid.UUID(wallet_id))
    wallet.balance = Decimal(amount)
    db.commit()


def test_create_expense_transaction_decreases_wallet_balance(client, db):
    token = _register(client)
    wallet = _create_wallet(client, token)
    _fund_wallet(db, wallet["id"], "100.00")

    response = client.post(
        "/api/transactions",
        json={"wallet_id": wallet["id"], "type": "expense", "amount": "30.00", "category": "Mercado"},
        headers=_auth_headers(token),
    )

    assert response.status_code == 201
    wallets_after = client.get("/api/wallets", headers=_auth_headers(token)).json()
    assert Decimal(wallets_after[0]["balance"]) == Decimal("70.00")


def test_create_income_transaction_increases_wallet_balance(client):
    token = _register(client)
    wallet = _create_wallet(client, token)

    response = client.post(
        "/api/transactions",
        json={"wallet_id": wallet["id"], "type": "income", "amount": "500.00", "category": "Ingreso"},
        headers=_auth_headers(token),
    )

    assert response.status_code == 201
    wallets_after = client.get("/api/wallets", headers=_auth_headers(token)).json()
    assert Decimal(wallets_after[0]["balance"]) == Decimal("500.00")


def test_delete_transaction_reverses_wallet_balance(client):
    token = _register(client)
    wallet = _create_wallet(client, token)
    transaction = client.post(
        "/api/transactions",
        json={"wallet_id": wallet["id"], "type": "income", "amount": "500.00", "category": "Ingreso"},
        headers=_auth_headers(token),
    ).json()

    delete_response = client.delete(f"/api/transactions/{transaction['id']}", headers=_auth_headers(token))

    assert delete_response.status_code == 204
    wallets_after = client.get("/api/wallets", headers=_auth_headers(token)).json()
    assert Decimal(wallets_after[0]["balance"]) == Decimal("0.00")


def test_list_transactions_supports_filters(client):
    token = _register(client)
    wallet = _create_wallet(client, token)
    client.post(
        "/api/transactions",
        json={"wallet_id": wallet["id"], "type": "expense", "amount": "20.00", "category": "Transporte"},
        headers=_auth_headers(token),
    )
    client.post(
        "/api/transactions",
        json={"wallet_id": wallet["id"], "type": "income", "amount": "500.00", "category": "Ingreso"},
        headers=_auth_headers(token),
    )

    response = client.get("/api/transactions", params={"category": "Transporte"}, headers=_auth_headers(token))

    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    assert body[0]["category"] == "Transporte"


def test_transactions_ownership_isolation(client):
    token_a = _register(client, "a@example.com")
    token_b = _register(client, "b@example.com")
    wallet_a = _create_wallet(client, token_a)
    transaction = client.post(
        "/api/transactions",
        json={"wallet_id": wallet_a["id"], "type": "income", "amount": "500.00", "category": "Ingreso"},
        headers=_auth_headers(token_a),
    ).json()

    list_response = client.get("/api/transactions", headers=_auth_headers(token_b))
    delete_response = client.delete(f"/api/transactions/{transaction['id']}", headers=_auth_headers(token_b))

    assert list_response.json() == []
    assert delete_response.status_code == 404


def test_draft_confirm_creates_transaction_and_flips_status(client, db):
    token = _register(client)
    wallet = _create_wallet(client, token)
    user_id = client.get("/api/auth/me", headers=_auth_headers(token)).json()["id"]
    draft = create_draft(db, uuid.UUID(user_id), "voice", "Gasté 15 usd en transporte", 15, "USD", "Transporte", "raw")

    response = client.post(
        f"/api/transactions/drafts/{draft.id}/confirm",
        json={"wallet_id": wallet["id"], "type": "expense", "final_amount": "15.00", "final_category": "Transporte"},
        headers=_auth_headers(token),
    )

    assert response.status_code == 200
    body = response.json()
    assert Decimal(str(body["amount"])) == Decimal("15.00")
    assert body["category"] == "Transporte"

    drafts_after = client.get("/api/transactions/drafts", params={"status": "confirmed"}, headers=_auth_headers(token))
    assert len(drafts_after.json()) == 1


def test_draft_discard_flips_status_without_creating_transaction(client, db):
    token = _register(client)
    user_id = client.get("/api/auth/me", headers=_auth_headers(token)).json()["id"]
    draft = create_draft(db, uuid.UUID(user_id), "ocr", "raw", None, None, None, None)

    response = client.post(f"/api/transactions/drafts/{draft.id}/discard", headers=_auth_headers(token))

    assert response.status_code == 200
    assert response.json()["status"] == "discarded"

    transactions_after = client.get("/api/transactions", headers=_auth_headers(token))
    assert transactions_after.json() == []


def test_draft_list_defaults_to_pending(client, db):
    token = _register(client)
    user_id = client.get("/api/auth/me", headers=_auth_headers(token)).json()["id"]
    create_draft(db, uuid.UUID(user_id), "voice", "raw", None, None, None, None)

    response = client.get("/api/transactions/drafts", headers=_auth_headers(token))

    assert response.status_code == 200
    assert len(response.json()) == 1
    assert response.json()[0]["status"] == "pending"


def test_draft_confirm_rejects_other_users_draft(client, db):
    token_a = _register(client, "a@example.com")
    token_b = _register(client, "b@example.com")
    wallet_a = _create_wallet(client, token_a)
    user_a_id = client.get("/api/auth/me", headers=_auth_headers(token_a)).json()["id"]
    draft = create_draft(db, uuid.UUID(user_a_id), "voice", "raw", 15, "USD", "Transporte", "raw")

    response = client.post(
        f"/api/transactions/drafts/{draft.id}/confirm",
        json={"wallet_id": wallet_a["id"], "type": "expense", "final_amount": "15.00", "final_category": "Transporte"},
        headers=_auth_headers(token_b),
    )

    assert response.status_code == 404
