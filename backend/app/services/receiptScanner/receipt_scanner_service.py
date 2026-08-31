import uuid
from decimal import Decimal

from sqlalchemy.orm import Session

from app.models.transactions.transaction_draft_model import TransactionDraft
from app.services.receiptScanner.ocr.vision_client import extract_text
from app.services.transactions.drafts.draft_review_service import create_draft
from app.services.transactions.drafts.entity_parser import parse_transaction_entities


def submit_receipt_scan(
    db: Session,
    user_id: uuid.UUID,
    default_currency: str,
    image_bytes: bytes,
    filename: str,
) -> TransactionDraft:
    """Orquesta el flujo de OCR completo: extrae el texto de la foto del recibo, extrae
    monto/moneda/categoría con el parser compartido, y persiste el resultado como un
    TransactionDraft pendiente de revisión.

    OcrNotConfiguredError se deja propagar tal cual (no se maneja acá) — es el router
    quien la traduce a una respuesta HTTP limpia.
    """
    text = extract_text(image_bytes, filename)
    parsed = parse_transaction_entities(text, default_currency)

    parsed_amount = Decimal(str(parsed.amount)) if parsed.amount is not None else None

    return create_draft(
        db,
        user_id=user_id,
        source="ocr",
        raw_input=text,
        parsed_amount=parsed_amount,
        parsed_currency=parsed.currency,
        parsed_category=parsed.category,
        parsed_description=parsed.description,
    )
