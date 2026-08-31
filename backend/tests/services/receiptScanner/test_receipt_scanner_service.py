from decimal import Decimal

import pytest

from app.services.auth.auth_service import register_user
from app.services.receiptScanner import receipt_scanner_service
from app.services.receiptScanner.errors import OcrNotConfiguredError


def _user(db, email="ana@example.com"):
    return register_user(db, email, "clave12345", "Ana")


def test_submit_receipt_scan_raises_when_ocr_not_configured(db):
    # Comportamiento real actual: OCR_PROVIDER_API_KEY está vacío en el entorno de test
    # (y en desarrollo, hasta que el usuario configure una key real), así que
    # vision_client levanta el error tipado apenas se lo llama, sin necesidad de
    # mockear nada.
    user = _user(db)

    with pytest.raises(OcrNotConfiguredError):
        receipt_scanner_service.submit_receipt_scan(db, user.id, "USD", b"fake-image-bytes", "receipt.jpg")


def test_submit_receipt_scan_creates_pending_draft_from_extracted_text(db, monkeypatch):
    user = _user(db)
    monkeypatch.setattr(
        receipt_scanner_service, "extract_text", lambda image_bytes, filename: "Gasté 15 USDT en el gym"
    )

    draft = receipt_scanner_service.submit_receipt_scan(db, user.id, "USD", b"fake-image-bytes", "receipt.jpg")

    assert draft.source == "ocr"
    assert draft.status == "pending"
    assert draft.raw_input == "Gasté 15 USDT en el gym"
    assert draft.parsed_amount == Decimal("15")
    assert draft.parsed_currency == "USDT"
    assert draft.parsed_category == "Gym"
