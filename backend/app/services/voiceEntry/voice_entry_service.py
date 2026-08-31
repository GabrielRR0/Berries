import uuid
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.transactions.transaction_draft_model import TransactionDraft
from app.models.wallets.wallet_model import Wallet
from app.services.transactions.drafts.draft_review_service import create_draft
from app.services.transactions.drafts.entity_parser import parse_transaction_entities
from app.services.transactions.drafts.full_balance_detector import detect_full_balance_wallet
from app.services.voiceEntry.correction.correction_service import correct_transcript


def submit_voice_entry(
    db: Session,
    user_id: uuid.UUID,
    default_currency: str,
    transcript: str,
) -> TransactionDraft:
    """La transcripción llega ya hecha por el navegador (Web Speech API) — acá solo se
    extrae monto/moneda/categoría del texto con el parser compartido y se persiste el
    resultado como un TransactionDraft pendiente de revisión. Sin dependencia de
    ninguna API externa (a diferencia de receiptScanner, que sí necesita OCR real).
    correct_transcript corrige términos propios del usuario mal transcritos (ej. el
    nombre real de una wallet) antes de parsear - ver
    services/voiceEntry/correction/correction_service.py, compartido con el registro
    por voz de metas."""
    corrected = correct_transcript(db, user_id, transcript).text
    parsed = parse_transaction_entities(corrected, default_currency)
    parsed_amount = Decimal(str(parsed.amount)) if parsed.amount is not None else None
    parsed_currency = parsed.currency

    # "gasté todo lo que tenía en mi cuenta de X" - si matchea una única wallet real del
    # usuario, el monto/moneda ya conocidos (el balance real de esa wallet) reemplazan
    # cualquier numero que el parser haya credo extraer del texto (ver
    # full_balance_detector.py: un pedido explicito mas confiable que un regex de monto).
    suggested_wallet_id: uuid.UUID | None = None
    wallets = list(db.scalars(select(Wallet).where(Wallet.user_id == user_id)))
    full_balance_wallet = detect_full_balance_wallet(corrected, wallets)
    if full_balance_wallet is not None:
        suggested_wallet_id = full_balance_wallet.id
        parsed_amount = full_balance_wallet.balance
        parsed_currency = full_balance_wallet.currency

    return create_draft(
        db,
        user_id=user_id,
        source="voice",
        raw_input=corrected,
        parsed_amount=parsed_amount,
        parsed_currency=parsed_currency,
        parsed_category=parsed.category,
        parsed_description=parsed.description,
        suggested_wallet_id=suggested_wallet_id,
    )
