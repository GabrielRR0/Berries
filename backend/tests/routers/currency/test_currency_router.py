import pytest

from app.core.rate_limit import limiter
from app.main import app
from app.routers.currency.currency_router import router as currency_router

# app/main.py todavía no incluye este router (lo cablea otro proceso más adelante) — se
# monta acá, sobre el mismo `app` compartido que usa el fixture `client` de conftest.py,
# para poder probar el router real de punta a punta sin tocar el archivo main.py.
if not any(getattr(route, "path", "").startswith("/api/currency") for route in app.routes):
    app.include_router(currency_router, prefix="/api/currency", tags=["currency"])


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


def test_convert_same_currency_returns_200(client):
    token = _register(client)

    response = client.get(
        "/api/currency/convert", params={"amount": "100", "from": "USD", "to": "USD"}, headers=_auth_headers(token)
    )

    assert response.status_code == 200
    body = response.json()
    assert float(body["converted_amount"]) == 100.0
    assert float(body["rate_used"]) == 1.0


def test_convert_cross_currency_returns_positive_number(client):
    token = _register(client)

    response = client.get(
        "/api/currency/convert", params={"amount": "100", "from": "USD", "to": "VEF"}, headers=_auth_headers(token)
    )

    assert response.status_code == 200
    body = response.json()
    assert float(body["converted_amount"]) > 0
    assert float(body["rate_used"]) > 0


def test_convert_requires_auth(client):
    response = client.get("/api/currency/convert", params={"amount": "100", "from": "USD", "to": "VEF"})

    assert response.status_code == 401


def test_convert_accepts_negative_amount(client):
    """Bug real encontrado en vivo: BalanceCard.vue convierte el BALANCE de cada
    wallet a la moneda de visualizacion, y una wallet puede estar en negativo
    (mas gastado que ingresado) - antes esto devolvia 422 y el balance total
    quedaba mal calculado (la wallet en negativo se salteaba silenciosamente)."""
    token = _register(client)

    response = client.get(
        "/api/currency/convert", params={"amount": "-100", "from": "USD", "to": "VEF"}, headers=_auth_headers(token)
    )

    assert response.status_code == 200
    assert float(response.json()["converted_amount"]) < 0


def test_convert_accepts_zero_amount(client):
    token = _register(client)

    response = client.get(
        "/api/currency/convert", params={"amount": "0", "from": "USD", "to": "VEF"}, headers=_auth_headers(token)
    )

    assert response.status_code == 200
    assert float(response.json()["converted_amount"]) == 0.0
