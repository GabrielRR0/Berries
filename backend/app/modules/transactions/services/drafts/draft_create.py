"""Crear borradores (de voz, de una foto o de capturas en lote) para que el usuario los revise."""

import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy.orm import Session

from app.modules.currency import get_currency_by_code
from app.modules.transactions.models.transaction_draft_model import TransactionDraft
from app.modules.wallets import get_wallet_owned_by_user


def create_draft(
    db: Session,
    user_id: uuid.UUID,
    source: str,
    raw_input: str | None,
    parsed_amount: Decimal | None,
    parsed_currency: str | None,
    parsed_category: str | None,
    parsed_description: str | None,
    suggested_wallet_id: uuid.UUID | None = None,
    txn_type: str | None = None,
    occurred_at: datetime | None = None,
    fee: Decimal | None = None,
    reference: str | None = None,
    commit: bool = True,
) -> TransactionDraft:
    parsed_currency_id = get_currency_by_code(db, parsed_currency).id if parsed_currency else None
    if suggested_wallet_id is not None:
        # Un borrador no puede apuntar a una billetera ajena.
        get_wallet_owned_by_user(db, suggested_wallet_id, user_id)
    draft = TransactionDraft(
        user_id=user_id,
        source=source,
        raw_input=raw_input,
        parsed_amount=parsed_amount,
        parsed_currency_id=parsed_currency_id,
        parsed_category=parsed_category,
        parsed_description=parsed_description,
        suggested_wallet_id=suggested_wallet_id,
        txn_type=txn_type,
        occurred_at=occurred_at,
        fee=fee,
        reference=reference,
    )
    db.add(draft)
    if commit:
        db.commit()
    else:
        db.flush()
    db.refresh(draft)
    return draft


def create_drafts_bulk(db: Session, user_id: uuid.UUID, items: list[dict]) -> list[TransactionDraft]:
    """Crea varios borradores de una vez (pendientes del registro desde capturas): si uno
    falla no se crea ninguno. Cada item son los kwargs de create_draft."""
    try:
        drafts = [create_draft(db, user_id, commit=False, **item) for item in items]
        db.commit()
    except Exception:
        db.rollback()
        raise
    for draft in drafts:
        db.refresh(draft)
    return drafts
