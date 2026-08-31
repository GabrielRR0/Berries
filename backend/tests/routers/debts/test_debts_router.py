from datetime import date


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
