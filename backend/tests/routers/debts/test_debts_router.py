from datetime import date, timedelta


def _register_and_token(client, email):
    response = client.post(
        "/api/auth/register", json={"email": email, "password": "supersecret123", "display_name": "T"}
    )
    return response.json()["access_token"]


def _auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


def _create_debt(client, token, **overrides):
    payload = {
        "counterparty_name": "Cashea",
        "direction": "owed_by_user",
        "total_amount": "100.00",
        "currency": "USD",
    }
    payload.update(overrides)
    return client.post("/api/debts", json=payload, headers=_auth_headers(token))


def test_create_debt_with_installments(client):
    token = _register_and_token(client, "ana@example.com")

    response = _create_debt(client, token, installment_count=3, first_due_date=str(date.today()))

    assert response.status_code == 201
    body = response.json()
    assert len(body["installments"]) == 3
    total = sum(float(i["amount"]) for i in body["installments"])
    assert round(total, 2) == 100.00


def test_create_debt_lump_sum_has_no_installments(client):
    token = _register_and_token(client, "beto@example.com")

    response = _create_debt(client, token)

    assert response.status_code == 201
    assert response.json()["installments"] == []


def test_create_debt_rejects_non_positive_amount(client):
    token = _register_and_token(client, "cami@example.com")

    response = _create_debt(client, token, total_amount="0")

    assert response.status_code in (400, 422)


def test_list_debts_filters_by_direction(client):
    token = _register_and_token(client, "dani@example.com")
    _create_debt(client, token, direction="owed_by_user", counterparty_name="Cashea")
    _create_debt(client, token, direction="owed_to_user", counterparty_name="Juan")

    response = client.get("/api/debts", params={"direction": "owed_to_user"}, headers=_auth_headers(token))

    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    assert body[0]["counterparty_name"] == "Juan"


def test_summary_endpoint_totals(client):
    token = _register_and_token(client, "eva@example.com")
    _create_debt(client, token, direction="owed_by_user", total_amount="30.00")
    _create_debt(client, token, direction="owed_to_user", total_amount="70.00")

    response = client.get("/api/debts/summary", headers=_auth_headers(token))

    assert response.status_code == 200
    body = response.json()
    assert float(body["total_owed_by_user"]) == 30.00
    assert float(body["total_owed_to_user"]) == 70.00


def test_pay_and_unpay_installment(client):
    token = _register_and_token(client, "fede@example.com")
    debt = _create_debt(client, token, installment_count=2, first_due_date=str(date.today())).json()
    debt_id = debt["id"]
    installment_id = debt["installments"][0]["id"]

    pay_response = client.post(f"/api/debts/{debt_id}/installments/{installment_id}/pay", headers=_auth_headers(token))
    assert pay_response.status_code == 200
    assert pay_response.json()["status"] == "paid"
    assert pay_response.json()["paid_at"] is not None

    double_pay = client.post(f"/api/debts/{debt_id}/installments/{installment_id}/pay", headers=_auth_headers(token))
    assert double_pay.status_code == 409

    unpay_response = client.post(
        f"/api/debts/{debt_id}/installments/{installment_id}/unpay", headers=_auth_headers(token)
    )
    assert unpay_response.status_code == 200
    assert unpay_response.json()["status"] == "pending"
    assert unpay_response.json()["paid_at"] is None


def test_delete_debt_removes_it(client):
    token = _register_and_token(client, "gus@example.com")
    debt_id = _create_debt(client, token).json()["id"]

    response = client.delete(f"/api/debts/{debt_id}", headers=_auth_headers(token))
    assert response.status_code == 204

    list_response = client.get("/api/debts", headers=_auth_headers(token))
    assert list_response.json() == []


def test_ownership_isolation_user_cannot_access_other_users_debt(client):
    token_a = _register_and_token(client, "hugo@example.com")
    token_b = _register_and_token(client, "ines@example.com")
    debt = _create_debt(client, token_a, installment_count=1, first_due_date=str(date.today())).json()
    debt_id = debt["id"]
    installment_id = debt["installments"][0]["id"]

    delete_response = client.delete(f"/api/debts/{debt_id}", headers=_auth_headers(token_b))
    assert delete_response.status_code == 404

    pay_response = client.post(f"/api/debts/{debt_id}/installments/{installment_id}/pay", headers=_auth_headers(token_b))
    assert pay_response.status_code == 404

    unpay_response = client.post(
        f"/api/debts/{debt_id}/installments/{installment_id}/unpay", headers=_auth_headers(token_b)
    )
    assert unpay_response.status_code == 404

    # user A conserva su deuda intacta y sigue pudiendo operar sobre ella
    still_there = client.get("/api/debts", headers=_auth_headers(token_a))
    assert len(still_there.json()) == 1


def test_endpoints_reject_missing_token(client):
    response = client.get("/api/debts")
    assert response.status_code == 401


def _create_wallet(client, token, name="Binance", currency="USDT", initial_balance="0"):
    return client.post(
        "/api/wallets",
        json={"name": name, "currency": currency, "initial_balance": initial_balance},
        headers=_auth_headers(token),
    ).json()


def test_add_payment_reduces_the_remaining_amount(client):
    token = _register_and_token(client, "iris@example.com")
    debt = _create_debt(client, token, direction="owed_to_user", total_amount="500.00").json()

    response = client.post(
        f"/api/debts/{debt['id']}/payments",
        json={"amount": "50", "currency": "USD"},
        headers=_auth_headers(token),
    )

    assert response.status_code == 201
    body = response.json()
    assert body["amount"] == "50"
    assert body["applied_amount"] == "50"

    debts = client.get("/api/debts", headers=_auth_headers(token)).json()
    updated = next(d for d in debts if d["id"] == debt["id"])
    assert updated["amount_paid"] == "50"
    assert updated["remaining_amount"] == "450.00"
    assert len(updated["payments"]) == 1


def test_add_payment_requires_applied_amount_for_a_different_currency(client):
    token = _register_and_token(client, "juan@example.com")
    debt = _create_debt(client, token, direction="owed_to_user", currency="USD").json()

    # VEF, no USDT: el par USD/USDT esta atado 1:1 (ver
    # test_add_payment_defaults_applied_amount_for_the_usd_usdt_peg) y nunca pide esto.
    response = client.post(
        f"/api/debts/{debt['id']}/payments",
        json={"amount": "50", "currency": "VEF"},
        headers=_auth_headers(token),
    )

    assert response.status_code == 400


def test_add_payment_defaults_applied_amount_for_the_usd_usdt_peg(client):
    token = _register_and_token(client, "kevin@example.com")
    debt = _create_debt(client, token, direction="owed_to_user", currency="USD").json()

    response = client.post(
        f"/api/debts/{debt['id']}/payments",
        json={"amount": "50", "currency": "USDT"},
        headers=_auth_headers(token),
    )

    assert response.status_code == 201
    assert response.json()["applied_amount"] == "50"


def test_add_payment_credits_a_real_wallet_as_income(client):
    token = _register_and_token(client, "karla@example.com")
    debt = _create_debt(client, token, direction="owed_to_user", currency="USDT", total_amount="500.00").json()
    wallet = _create_wallet(client, token, currency="USDT", initial_balance="10")

    response = client.post(
        f"/api/debts/{debt['id']}/payments",
        json={"amount": "50", "currency": "USDT", "wallet_id": wallet["id"]},
        headers=_auth_headers(token),
    )

    assert response.status_code == 201
    wallets = client.get("/api/wallets", headers=_auth_headers(token)).json()
    updated_wallet = next(w for w in wallets if w["id"] == wallet["id"])
    assert updated_wallet["balance"] == "60"


def test_add_payment_rejects_a_wallet_in_a_different_currency(client):
    token = _register_and_token(client, "liz@example.com")
    debt = _create_debt(client, token, direction="owed_to_user", currency="USD").json()
    # La billetera esta en EUR, distinto de la moneda DEL PAGO (USD) - asi el 400
    # viene realmente del chequeo de billetera, no del par USD/USDT (que ya no pide
    # applied_amount y hubiera dado 201 antes de llegar a validar la billetera).
    wallet = _create_wallet(client, token, currency="EUR")

    response = client.post(
        f"/api/debts/{debt['id']}/payments",
        json={"amount": "50", "currency": "USD", "wallet_id": wallet["id"]},
        headers=_auth_headers(token),
    )

    assert response.status_code == 400


def test_delete_payment_reverses_the_wallet_credit(client):
    token = _register_and_token(client, "manu@example.com")
    debt = _create_debt(client, token, direction="owed_to_user", currency="USDT").json()
    wallet = _create_wallet(client, token, currency="USDT", initial_balance="10")
    payment = client.post(
        f"/api/debts/{debt['id']}/payments",
        json={"amount": "50", "currency": "USDT", "wallet_id": wallet["id"]},
        headers=_auth_headers(token),
    ).json()

    response = client.delete(f"/api/debts/{debt['id']}/payments/{payment['id']}", headers=_auth_headers(token))
    assert response.status_code == 204

    wallets = client.get("/api/wallets", headers=_auth_headers(token)).json()
    updated_wallet = next(w for w in wallets if w["id"] == wallet["id"])
    assert updated_wallet["balance"] == "10"


def test_payments_ownership_isolation(client):
    token_a = _register_and_token(client, "nico@example.com")
    token_b = _register_and_token(client, "olga@example.com")
    debt = _create_debt(client, token_a, direction="owed_to_user").json()

    add_response = client.post(
        f"/api/debts/{debt['id']}/payments",
        json={"amount": "50", "currency": "USD"},
        headers=_auth_headers(token_b),
    )
    assert add_response.status_code == 404

    payment = client.post(
        f"/api/debts/{debt['id']}/payments",
        json={"amount": "50", "currency": "USD"},
        headers=_auth_headers(token_a),
    ).json()

    delete_response = client.delete(
        f"/api/debts/{debt['id']}/payments/{payment['id']}", headers=_auth_headers(token_b)
    )
    assert delete_response.status_code == 404


def test_parse_payment_voice_extracts_amount_currency_and_date(client):
    token = _register_and_token(client, "pedro@example.com")
    debt = _create_debt(client, token, direction="owed_to_user", currency="USDT").json()

    response = client.post(
        f"/api/debts/{debt['id']}/payments/parse-voice",
        json={"transcript": "ayer me pagaron 50 usdt"},
        headers=_auth_headers(token),
    )

    assert response.status_code == 200
    body = response.json()
    assert body["amount"] == "50.0"
    assert body["currency"] == "USDT"
    assert body["paid_at"] == str(date.today() - timedelta(days=1))
