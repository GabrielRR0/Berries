import uuid
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.transactions.transaction_draft_model import TransactionDraft
from app.models.transactions.transaction_model import Transaction
from app.services.currency.currency_lookup import get_currency_by_code
from app.services.transactions.errors import DraftNotFoundError
from app.services.transactions.transaction_service import create_transaction


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
) -> TransactionDraft:
    parsed_currency_id = get_currency_by_code(db, parsed_currency).id if parsed_currency else None
    draft = TransactionDraft(
        user_id=user_id,
        source=source,
        raw_input=raw_input,
        parsed_amount=parsed_amount,
        parsed_currency_id=parsed_currency_id,
        parsed_category=parsed_category,
        parsed_description=parsed_description,
        suggested_wallet_id=suggested_wallet_id,
    )
    db.add(draft)
    db.commit()
    db.refresh(draft)
    return draft


def list_drafts_for_user(db: Session, user_id: uuid.UUID, status: str | None = "pending") -> list[TransactionDraft]:
    query = select(TransactionDraft).where(TransactionDraft.user_id == user_id)
    if status is not None:
        query = query.where(TransactionDraft.status == status)
    return list(db.scalars(query.order_by(TransactionDraft.created_at.desc())))


def _get_draft_owned_by_user(db: Session, draft_id: uuid.UUID, user_id: uuid.UUID) -> TransactionDraft:
    draft = db.get(TransactionDraft, draft_id)
    if draft is None or draft.user_id != user_id:
        raise DraftNotFoundError("Borrador no encontrado")
    return draft


def confirm_draft(
    db: Session,
    draft_id: uuid.UUID,
    user_id: uuid.UUID,
    wallet_id: uuid.UUID,
    final_amount: Decimal,
    final_category: str,
    final_description: str | None,
    type: str,
) -> tuple[Transaction, TransactionDraft]:
    """Crea la transacción real (delega en transaction_service, que ya aplica el delta
    de saldo al wallet) y marca el draft como confirmado."""
    draft = _get_draft_owned_by_user(db, draft_id, user_id)

    transaction = create_transaction(
        db,
        user_id=user_id,
        wallet_id=wallet_id,
        type=type,
        amount=final_amount,
        category=final_category,
        description=final_description,
        source=draft.source,
    )

    draft.status = "confirmed"
    db.commit()
    db.refresh(draft)
    return transaction, draft


def discard_draft(db: Session, draft_id: uuid.UUID, user_id: uuid.UUID) -> TransactionDraft:
    draft = _get_draft_owned_by_user(db, draft_id, user_id)
    draft.status = "discarded"
    db.commit()
    db.refresh(draft)
    return draft
