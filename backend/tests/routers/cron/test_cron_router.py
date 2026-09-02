from app.config import settings
from app.services.auth.auth_service import register_user
from app.services.wallets.wallet_service import create_wallet


def test_refresh_daily_without_cron_secret_configured_returns_503(client):
    # settings.cron_secret arranca vacío en el entorno de test (ver conftest.py) - el
    # endpoint debe quedar inalcanzable en vez de aceptar cualquier pedido sin credencial.
    response = client.get("/api/cron/refresh-daily")

    assert response.status_code == 503


def test_refresh_daily_without_authorization_header_returns_401(client, monkeypatch):
    monkeypatch.setattr(settings, "cron_secret", "el-secreto-real")

    response = client.get("/api/cron/refresh-daily")

    assert response.status_code == 401


def test_refresh_daily_with_wrong_secret_returns_401(client, monkeypatch):
    monkeypatch.setattr(settings, "cron_secret", "el-secreto-real")

    response = client.get(
        "/api/cron/refresh-daily", headers={"Authorization": "Bearer un-secreto-adivinado"}
    )

    assert response.status_code == 401


def test_refresh_daily_with_the_correct_secret_refreshes_currencies_in_use(client, db, monkeypatch):
    monkeypatch.setattr(settings, "cron_secret", "el-secreto-real")
    user = register_user(db, "ana@example.com", "clave12345", "Ana")
    create_wallet(db, user.id, "Efectivo", "VEF")
    db.commit()

    response = client.get(
        "/api/cron/refresh-daily", headers={"Authorization": "Bearer el-secreto-real"}
    )

    assert response.status_code == 200
    assert response.json() == {"refreshed_currencies": ["VEF"]}


def test_refresh_daily_does_not_require_a_logged_in_user(client, monkeypatch):
    # Lo invoca la infraestructura de Vercel, no una persona con cuenta - a propósito
    # no depende de get_current_user/un token de login, solo del secreto compartido.
    monkeypatch.setattr(settings, "cron_secret", "el-secreto-real")

    response = client.get(
        "/api/cron/refresh-daily", headers={"Authorization": "Bearer el-secreto-real"}
    )

    assert response.status_code == 200
