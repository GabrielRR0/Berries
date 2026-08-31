from app.config import settings


def _register(client, email="ana@example.com", password="supersecret123"):
    return client.post("/api/auth/register", json={"email": email, "password": password, "display_name": "Ana"})


def test_register_creates_user_and_returns_token(client):
    response = _register(client)

    assert response.status_code == 201
    body = response.json()
    assert body["access_token"]
    assert body["user"]["email"] == "ana@example.com"
    assert body["user"]["default_currency"] == "USD"


def test_register_rejects_duplicate_email(client):
    _register(client)
    response = _register(client)

    assert response.status_code == 409


def test_register_creates_wallets_from_the_wizard(client):
    response = client.post(
        "/api/auth/register",
        json={
            "email": "wanda@example.com",
            "password": "supersecret123",
            "default_currency": "VEF",
            "wallets": [
                {"name": "Facebank", "currency": "USD", "initial_balance": "150.50"},
                {"name": "Banco de Venezuela", "currency": "VEF"},
            ],
        },
    )

    assert response.status_code == 201
    body = response.json()
    assert body["user"]["default_currency"] == "VEF"

    token = body["access_token"]
    wallets = client.get("/api/wallets", headers={"Authorization": f"Bearer {token}"}).json()
    assert {(w["name"], w["currency"], w["balance"]) for w in wallets} == {
        ("Facebank", "USD", "150.50"),
        ("Banco de Venezuela", "VEF", "0"),
    }


def test_register_rejects_an_unsupported_wallet_currency(client):
    response = client.post(
        "/api/auth/register",
        json={
            "email": "xavi@example.com",
            "password": "supersecret123",
            "wallets": [{"name": "Rara", "currency": "XYZ"}],
        },
    )

    assert response.status_code == 400


def test_login_with_correct_credentials_returns_token(client):
    _register(client, email="beto@example.com", password="clave12345")

    response = client.post("/api/auth/login", json={"email": "beto@example.com", "password": "clave12345"})

    assert response.status_code == 200
    assert response.json()["access_token"]


def test_login_with_wrong_password_is_rejected(client):
    _register(client, email="cami@example.com", password="clave12345")

    response = client.post("/api/auth/login", json={"email": "cami@example.com", "password": "incorrecta"})

    assert response.status_code == 401


def test_me_returns_current_user_with_valid_token(client):
    token = _register(client, email="dani@example.com").json()["access_token"]

    response = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 200
    assert response.json()["email"] == "dani@example.com"


def test_me_rejects_missing_token(client):
    response = client.get("/api/auth/me")

    assert response.status_code == 401


def test_delete_me_removes_the_account(client):
    token = _register(client, email="dani@example.com").json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    response = client.delete("/api/auth/me", headers=headers)

    assert response.status_code == 204
    # El mismo token ya no sirve para nada - el usuario que nombra ya no existe.
    assert client.get("/api/auth/me", headers=headers).status_code == 401
    # Se puede volver a registrar el mismo correo, prueba de que no quedó rastro.
    assert _register(client, email="dani@example.com").status_code == 201


def test_delete_me_removes_data_created_from_the_wizard(client):
    response = client.post(
        "/api/auth/register",
        json={
            "email": "wanda@example.com",
            "password": "supersecret123",
            "wallets": [{"name": "Facebank", "currency": "USD", "initial_balance": "150.50"}],
        },
    )
    token = response.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    assert len(client.get("/api/wallets", headers=headers).json()) == 1

    delete_response = client.delete("/api/auth/me", headers=headers)

    assert delete_response.status_code == 204
    assert client.get("/api/wallets", headers=headers).status_code == 401


def test_delete_me_rejects_missing_token(client):
    response = client.delete("/api/auth/me")

    assert response.status_code == 401


def test_register_rejects_once_beta_limit_is_reached(client, monkeypatch):
    monkeypatch.setattr(settings, "max_beta_users", 1)

    first = _register(client, email="uno@example.com")
    second = _register(client, email="dos@example.com")

    assert first.status_code == 201
    assert second.status_code == 403


def test_register_rejects_missing_turnstile_token_when_enabled(client, monkeypatch):
    monkeypatch.setattr(settings, "turnstile_enabled", True)

    response = client.post(
        "/api/auth/register", json={"email": "yara@example.com", "password": "supersecret123"}
    )

    assert response.status_code == 400


def test_login_rejects_missing_turnstile_token_when_enabled(client, monkeypatch):
    _register(client, email="zoe@example.com", password="clave12345")
    monkeypatch.setattr(settings, "turnstile_enabled", True)

    response = client.post("/api/auth/login", json={"email": "zoe@example.com", "password": "clave12345"})

    assert response.status_code == 400


def test_register_succeeds_with_a_valid_turnstile_token_when_enabled(client, monkeypatch):
    monkeypatch.setattr(settings, "turnstile_enabled", True)
    monkeypatch.setattr("app.routers.auth.auth_router.verify_turnstile", lambda token, ip: None)

    response = client.post(
        "/api/auth/register",
        json={"email": "iris@example.com", "password": "supersecret123", "turnstile_token": "token-valido"},
    )

    assert response.status_code == 201


def test_google_login_rejects_when_not_configured(client):
    response = client.post("/api/auth/google", json={"id_token": "cualquier-token"})

    assert response.status_code == 400


def test_google_login_creates_a_user_with_a_valid_token(client, monkeypatch):
    from app.shared.google_auth import GoogleIdentity

    monkeypatch.setattr(
        "app.services.auth.auth_service.verify_google_id_token",
        lambda token: GoogleIdentity(sub="google-1", email="juno@example.com", email_verified=True, name="Juno"),
    )

    response = client.post("/api/auth/google", json={"id_token": "token-valido"})

    assert response.status_code == 200
    body = response.json()
    assert body["user"]["email"] == "juno@example.com"
    assert body["access_token"]


def test_google_check_rejects_when_not_configured(client):
    response = client.post("/api/auth/google/check", json={"id_token": "cualquier-token"})

    assert response.status_code == 400


def test_google_check_returns_false_for_an_identity_with_no_account(client, monkeypatch):
    from app.shared.google_auth import GoogleIdentity

    monkeypatch.setattr(
        "app.services.auth.auth_service.verify_google_id_token",
        lambda token: GoogleIdentity(sub="google-2", email="nueva@example.com", email_verified=True, name="Nueva"),
    )

    response = client.post("/api/auth/google/check", json={"id_token": "token-valido"})

    assert response.status_code == 200
    assert response.json() == {"exists": False}


def test_google_check_returns_true_once_the_account_was_created(client, monkeypatch):
    from app.shared.google_auth import GoogleIdentity

    monkeypatch.setattr(
        "app.services.auth.auth_service.verify_google_id_token",
        lambda token: GoogleIdentity(sub="google-3", email="ya-existe@example.com", email_verified=True, name="Ya"),
    )
    client.post("/api/auth/google", json={"id_token": "token-valido"})

    response = client.post("/api/auth/google/check", json={"id_token": "token-valido"})

    assert response.status_code == 200
    assert response.json() == {"exists": True}


def test_google_check_returns_true_for_an_email_already_registered_with_a_password(client, monkeypatch):
    from app.shared.google_auth import GoogleIdentity

    _register(client, email="lina@example.com")
    monkeypatch.setattr(
        "app.services.auth.auth_service.verify_google_id_token",
        lambda token: GoogleIdentity(sub="google-4", email="lina@example.com", email_verified=True, name="Lina"),
    )

    response = client.post("/api/auth/google/check", json={"id_token": "token-valido"})

    assert response.status_code == 200
    assert response.json() == {"exists": True}
