import uuid
from decimal import Decimal

import pytest

from app.core.rate_limit import limiter
from app.main import app
from app.models.wallets.wallet_model import Wallet
from app.routers.transactions.transactions_router import router as transactions_router
from app.routers.wallets.wallets_router import router as wallets_router

# Mismo montaje que test_transactions_router.py (main.py no siempre incluye estos routers).
if not any(getattr(route, "path", "").startswith("/api/wallets") for route in app.routes):
    app.include_router(wallets_router, prefix="/api/wallets", tags=["wallets"])
if not any(getattr(route, "path", "").startswith("/api/transactions") for route in app.routes):
    app.include_router(transactions_router, prefix="/api/transactions", tags=["transactions"])


@pytest.fixture(autouse=True)
def _reset_rate_limiter():
    limiter.reset()
    yield


def _register(client, email="ana@example.com"):
    response = client.post(
        "/api/auth/register", json={"email": email, "password": "supersecret123", "display_name": "Ana"}
    )
    return response.json()["access_token"]


def _headers(token):
    return {"Authorization": f"Bearer {token}"}


def _wallet(client, token, name, currency):
    return client.post("/api/wallets", json={"name": name, "currency": currency}, headers=_headers(token)).json()


def _fund(db, wallet_id, amount):
    wallet = db.get(Wallet, uuid.UUID(wallet_id))
    wallet.balance = Decimal(amount)
    db.commit()


def _balance(db, wallet_id):
    wallet = db.get(Wallet, uuid.UUID(wallet_id))
    db.refresh(wallet)
    return wallet.balance


def test_bulk_create_registers_every_row(client, db):
    token = _register(client)
    bs = _wallet(client, token, "BDV", "VEF")
    _fund(db, bs["id"], "100000")

    response = client.post(
        "/api/transactions/bulk",
        json={
            "items": [
                {"wallet_id": bs["id"], "type": "expense", "amount": "22848.00", "category": "Mercado", "source": "screenshot"},
                {"wallet_id": bs["id"], "type": "expense", "amount": "68.54", "category": "Comisión", "source": "screenshot"},
                {"wallet_id": bs["id"], "type": "income", "amount": "10000.00", "category": "Otros ingresos", "source": "screenshot"},
            ]
        },
        headers=_headers(token),
    )

    assert response.status_code == 201
    assert len(response.json()) == 3
    assert _balance(db, bs["id"]) == Decimal("100000") - Decimal("22848.00") - Decimal("68.54") + Decimal("10000.00")


def test_bulk_create_is_all_or_nothing(client, db):
    token = _register(client)
    other_token = _register(client, "otro@example.com")
    mine = _wallet(client, token, "BDV", "VEF")
    foreign = _wallet(client, other_token, "Ajena", "VEF")
    _fund(db, mine["id"], "1000")

    response = client.post(
        "/api/transactions/bulk",
        json={
            "items": [
                {"wallet_id": mine["id"], "type": "expense", "amount": "100", "category": "Mercado"},
                {"wallet_id": foreign["id"], "type": "expense", "amount": "50", "category": "Mercado"},
            ]
        },
        headers=_headers(token),
    )

    assert response.status_code == 400
    assert _balance(db, mine["id"]) == Decimal("1000")
    assert client.get("/api/transactions", headers=_headers(token)).json() == []


def test_pending_draft_roundtrip_and_edit(client, db):
    token = _register(client)
    bs = _wallet(client, token, "BDV", "VEF")

    created = client.post(
        "/api/transactions/drafts/bulk",
        json={
            "items": [
                {
                    "parsed_amount": "26600.00",
                    "parsed_currency": "VEF",
                    "parsed_description": "Abono recibido otr bcos",
                    "suggested_wallet_id": bs["id"],
                    "txn_type": "income",
                    "occurred_at": "2026-10-08T21:58:00Z",
                    "reference": "007608296806",
                }
            ]
        },
        headers=_headers(token),
    )

    assert created.status_code == 201
    draft = created.json()[0]
    assert draft["source"] == "screenshot"
    assert draft["status"] == "pending"
    assert draft["txn_type"] == "income"
    assert draft["reference"] == "007608296806"

    edited = client.patch(
        f"/api/transactions/drafts/{draft['id']}",
        json={"parsed_category": "Otros ingresos", "fee": "0.5"},
        headers=_headers(token),
    )

    assert edited.status_code == 200
    assert edited.json()["parsed_category"] == "Otros ingresos"
    assert Decimal(edited.json()["fee"]) == Decimal("0.5")
    assert Decimal(edited.json()["parsed_amount"]) == Decimal("26600.00")

    pending = client.get("/api/transactions/drafts", headers=_headers(token)).json()
    assert [d["id"] for d in pending] == [draft["id"]]


def test_draft_cannot_point_to_a_foreign_wallet(client):
    token = _register(client)
    other_token = _register(client, "otro@example.com")
    foreign = _wallet(client, other_token, "Ajena", "VEF")

    response = client.post(
        "/api/transactions/drafts/bulk",
        json={"items": [{"parsed_amount": "10", "suggested_wallet_id": foreign["id"]}]},
        headers=_headers(token),
    )

    assert response.status_code == 404


def test_confirm_draft_with_fee_creates_expense_and_commission(client, db):
    token = _register(client)
    bs = _wallet(client, token, "BDV", "VEF")
    _fund(db, bs["id"], "50000")
    draft = client.post(
        "/api/transactions/drafts/bulk",
        json={
            "items": [
                {"parsed_amount": "22848", "parsed_currency": "VEF", "txn_type": "expense", "occurred_at": "2026-10-08T22:25:00Z"}
            ]
        },
        headers=_headers(token),
    ).json()[0]

    response = client.post(
        f"/api/transactions/drafts/{draft['id']}/confirm",
        json={
            "wallet_id": bs["id"],
            "type": "expense",
            "final_amount": "22848",
            "final_category": "Mercado",
            "fee": "68.54",
        },
        headers=_headers(token),
    )

    assert response.status_code == 200
    assert response.json()["occurred_at"].startswith("2026-10-08T22:25")
    assert _balance(db, bs["id"]) == Decimal("50000") - Decimal("22848") - Decimal("68.54")
    categories = sorted(t["category"] for t in client.get("/api/transactions", headers=_headers(token)).json())
    assert categories == ["Comisión", "Mercado"]


def test_confirm_pending_income_as_transfer_completes_the_usdt_side(client, db):
    token = _register(client)
    usdt = _wallet(client, token, "Binance", "USDT")
    bs = _wallet(client, token, "BDV", "VEF")
    _fund(db, usdt["id"], "100")
    draft = client.post(
        "/api/transactions/drafts/bulk",
        json={
            "items": [
                {
                    "parsed_amount": "26600",
                    "parsed_currency": "VEF",
                    "suggested_wallet_id": bs["id"],
                    "txn_type": "income",
                    "occurred_at": "2026-10-08T21:58:00Z",
                }
            ]
        },
        headers=_headers(token),
    ).json()[0]

    response = client.post(
        f"/api/transactions/drafts/{draft['id']}/confirm-transfer",
        json={"from_wallet_id": usdt["id"], "sent_amount": "26.42", "fee": "0.06"},
        headers=_headers(token),
    )

    assert response.status_code == 200
    assert response.json()["status"] == "confirmed"
    assert _balance(db, usdt["id"]) == Decimal("100") - Decimal("26.42") - Decimal("0.06")
    assert _balance(db, bs["id"]) == Decimal("26600")
    assert client.get("/api/transactions/drafts", headers=_headers(token)).json() == []


def test_confirm_as_transfer_rejects_insufficient_balance_and_keeps_draft_pending(client, db):
    token = _register(client)
    usdt = _wallet(client, token, "Binance", "USDT")
    bs = _wallet(client, token, "BDV", "VEF")
    draft = client.post(
        "/api/transactions/drafts/bulk",
        json={"items": [{"parsed_amount": "26600", "parsed_currency": "VEF", "suggested_wallet_id": bs["id"]}]},
        headers=_headers(token),
    ).json()[0]

    response = client.post(
        f"/api/transactions/drafts/{draft['id']}/confirm-transfer",
        json={"from_wallet_id": usdt["id"], "sent_amount": "26.42"},
        headers=_headers(token),
    )

    assert response.status_code == 400
    pending = client.get("/api/transactions/drafts", headers=_headers(token)).json()
    assert [d["id"] for d in pending] == [draft["id"]]


def test_confirm_as_transfer_without_destination_is_rejected(client, db):
    token = _register(client)
    usdt = _wallet(client, token, "Binance", "USDT")
    _fund(db, usdt["id"], "100")
    draft = client.post(
        "/api/transactions/drafts/bulk",
        json={"items": [{"parsed_amount": "26600", "parsed_currency": "VEF"}]},
        headers=_headers(token),
    ).json()[0]

    response = client.post(
        f"/api/transactions/drafts/{draft['id']}/confirm-transfer",
        json={"from_wallet_id": usdt["id"], "sent_amount": "26.42"},
        headers=_headers(token),
    )

    assert response.status_code == 404
