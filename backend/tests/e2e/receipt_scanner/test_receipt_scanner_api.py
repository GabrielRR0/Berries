from app.modules.receipt_scanner.services import receipt_scanner_service


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
