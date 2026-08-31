import pytest

from app.core.rate_limit import limiter
from app.main import app
from app.routers.receiptScanner.receipt_scanner_router import router as receipt_scanner_router
from app.services.receiptScanner import receipt_scanner_service

# app/main.py todavía no incluye este router (queda fuera de los límites de esta tarea
# tocarlo) — se monta acá, sobre el mismo `app` compartido que usa el fixture `client`
# de conftest.py, para poder probar el router real de punta a punta sin tocar main.py.
if not any(getattr(route, "path", "").startswith("/api/receipt-scanner") for route in app.routes):
    app.include_router(receipt_scanner_router, prefix="/api/receipt-scanner", tags=["receiptScanner"])


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


def test_receipt_scanner_returns_503_when_ocr_not_configured(client):
    # Comportamiento real actual: sin OCR_PROVIDER_API_KEY configurada, el endpoint debe
    # responder con un 503 limpio en vez de un 500 o un texto inventado.
    token = _register(client)

    response = client.post(
        "/api/receipt-scanner",
        headers=_auth_headers(token),
        files={"image": ("test.jpg", b"fake-image-bytes", "image/jpeg")},
    )

    assert response.status_code == 503
    assert "OCR_PROVIDER_API_KEY" in response.json()["detail"]


def test_receipt_scanner_creates_draft_when_ocr_succeeds(client, monkeypatch):
    token = _register(client)
    monkeypatch.setattr(
        receipt_scanner_service, "extract_text", lambda image_bytes, filename: "Gasté 15 USDT en el gym"
    )

    response = client.post(
        "/api/receipt-scanner",
        headers=_auth_headers(token),
        files={"image": ("test.jpg", b"fake-image-bytes", "image/jpeg")},
    )

    assert response.status_code == 201
    body = response.json()
    assert body["source"] == "ocr"
    assert body["status"] == "pending"
    assert body["raw_input"] == "Gasté 15 USDT en el gym"
    assert float(body["parsed_amount"]) == 15.0
    assert body["parsed_currency"] == "USDT"
    assert body["parsed_category"] == "Gym"


def test_receipt_scanner_requires_auth(client):
    response = client.post("/api/receipt-scanner", files={"image": ("test.jpg", b"fake-image-bytes", "image/jpeg")})

    assert response.status_code == 401
