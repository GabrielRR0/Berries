import uuid
from decimal import Decimal


from app.modules.wallets import Wallet


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


def test_transfer_accepts_an_explicit_occurred_at(client, db):
    token = _register(client)
    cash_id = _create_wallet(client, token, "Cash", "USD").json()["id"]
    bank_id = _create_wallet(client, token, "Banco", "USD").json()["id"]
    _fund_wallet(db, cash_id, "100.00")

    response = client.post(
        "/api/wallets/transfer",
        json={
            "from_wallet_id": cash_id,
            "to_wallet_id": bank_id,
            "amount": "40.00",
            "occurred_at": "2026-01-15T12:00:00Z",
        },
        headers=_auth_headers(token),
    )

    assert response.status_code == 200
    transactions = client.get("/api/transactions", headers=_auth_headers(token)).json()
    assert all(t["occurred_at"].startswith("2026-01-15T12:00:00") for t in transactions)


def _transfer_id_of(client, token):
    transactions = client.get("/api/transactions", headers=_auth_headers(token)).json()
    expense_leg = next(t for t in transactions if t["type"] == "expense" and t["category"] == "Transferencia")
    return expense_leg["transfer_id"]


def test_update_transfer_changes_amount_and_date(client, db):
    token = _register(client)
    cash_id = _create_wallet(client, token, "Cash", "USD").json()["id"]
    bank_id = _create_wallet(client, token, "Banco", "USD").json()["id"]
    _fund_wallet(db, cash_id, "100.00")
    client.post(
        "/api/wallets/transfer",
        json={"from_wallet_id": cash_id, "to_wallet_id": bank_id, "amount": "40.00"},
        headers=_auth_headers(token),
    )
    transfer_id = _transfer_id_of(client, token)

    response = client.patch(
        f"/api/wallets/transfer/{transfer_id}",
        json={"amount": "60.00", "occurred_at": "2026-02-01T09:00:00Z"},
        headers=_auth_headers(token),
    )

    assert response.status_code == 200
    body = response.json()
    assert Decimal(body["from_wallet"]["balance"]) == Decimal("40.00")
    assert Decimal(body["to_wallet"]["balance"]) == Decimal("60.00")

    transactions = client.get("/api/transactions", headers=_auth_headers(token)).json()
    assert all(Decimal(t["amount"]) == Decimal("60.00") for t in transactions)
    assert all(t["occurred_at"].startswith("2026-02-01T09:00:00") for t in transactions)


def test_update_transfer_rejects_insufficient_balance(client, db):
    token = _register(client)
    cash_id = _create_wallet(client, token, "Cash", "USD").json()["id"]
    bank_id = _create_wallet(client, token, "Banco", "USD").json()["id"]
    _fund_wallet(db, cash_id, "50.00")
    client.post(
        "/api/wallets/transfer",
        json={"from_wallet_id": cash_id, "to_wallet_id": bank_id, "amount": "10.00"},
        headers=_auth_headers(token),
    )
    transfer_id = _transfer_id_of(client, token)

    response = client.patch(
        f"/api/wallets/transfer/{transfer_id}",
        json={"amount": "1000.00", "occurred_at": "2026-02-01T09:00:00Z"},
        headers=_auth_headers(token),
    )

    assert response.status_code == 400


def test_update_transfer_returns_404_for_an_unknown_transfer_id(client):
    token = _register(client)

    response = client.patch(
        f"/api/wallets/transfer/{uuid.uuid4()}",
        json={"amount": "10.00", "occurred_at": "2026-02-01T09:00:00Z"},
        headers=_auth_headers(token),
    )

    assert response.status_code == 404


def test_update_transfer_returns_404_for_another_users_transfer(client, db):
    token_a = _register(client, "a@example.com")
    token_b = _register(client, "b@example.com")
    cash_id = _create_wallet(client, token_a, "Cash", "USD").json()["id"]
    bank_id = _create_wallet(client, token_a, "Banco", "USD").json()["id"]
    _fund_wallet(db, cash_id, "100.00")
    client.post(
        "/api/wallets/transfer",
        json={"from_wallet_id": cash_id, "to_wallet_id": bank_id, "amount": "10.00"},
        headers=_auth_headers(token_a),
    )
    transfer_id = _transfer_id_of(client, token_a)

    response = client.patch(
        f"/api/wallets/transfer/{transfer_id}",
        json={"amount": "20.00", "occurred_at": "2026-02-01T09:00:00Z"},
        headers=_auth_headers(token_b),
    )

    assert response.status_code == 404


def test_wallet_endpoints_require_auth(client):
    response = client.get("/api/wallets")

    assert response.status_code == 401


def _create_transaction(client, token, wallet_id, type_, amount, occurred_at):
    return client.post(
        "/api/transactions",
        json={
            "wallet_id": wallet_id,
            "type": type_,
            "amount": amount,
            "category": "Prueba",
            "occurred_at": occurred_at,
        },
        headers=_auth_headers(token),
    )


def test_statement_shows_running_balance_and_opening_balance(client):
    token = _register(client)
    wallet_id = client.post(
        "/api/wallets",
        json={"name": "Tether", "currency": "USDT", "initial_balance": "100"},
        headers=_auth_headers(token),
    ).json()["id"]
    _create_transaction(client, token, wallet_id, "expense", "10", "2026-11-01T10:00:00Z")
    _create_transaction(client, token, wallet_id, "income", "10", "2026-11-02T10:00:00Z")
    _create_transaction(client, token, wallet_id, "expense", "25", "2026-11-03T10:00:00Z")

    response = client.get(f"/api/wallets/{wallet_id}/statement", headers=_auth_headers(token))

    assert response.status_code == 200
    body = response.json()
    assert Decimal(body["opening_balance"]) == Decimal("100")
    assert Decimal(body["current_balance"]) == Decimal("75")
    # Del más reciente al más antiguo.
    assert [(e["type"], Decimal(e["balance_before"]), Decimal(e["balance_after"])) for e in body["entries"]] == [
        ("expense", Decimal("100"), Decimal("75")),
        ("income", Decimal("90"), Decimal("100")),
        ("expense", Decimal("100"), Decimal("90")),
    ]


def test_statement_only_includes_that_wallets_movements(client):
    token = _register(client)
    cash_id = _create_wallet(client, token, "Cash", "USD").json()["id"]
    bank_id = _create_wallet(client, token, "Banco", "USD").json()["id"]
    _create_transaction(client, token, cash_id, "income", "50", "2026-11-01T10:00:00Z")
    _create_transaction(client, token, bank_id, "income", "70", "2026-11-01T11:00:00Z")

    body = client.get(f"/api/wallets/{cash_id}/statement", headers=_auth_headers(token)).json()

    assert len(body["entries"]) == 1
    assert Decimal(body["entries"][0]["balance_after"]) == Decimal("50")
    assert Decimal(body["opening_balance"]) == Decimal("0")


def test_statement_rejects_other_users_wallet(client):
    token_a = _register(client, "a@example.com")
    token_b = _register(client, "b@example.com")
    wallet_id = _create_wallet(client, token_a).json()["id"]

    response = client.get(f"/api/wallets/{wallet_id}/statement", headers=_auth_headers(token_b))

    assert response.status_code == 404
