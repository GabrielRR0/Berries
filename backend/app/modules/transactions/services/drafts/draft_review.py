"""Listar, editar y descartar borradores pendientes."""

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.currency import get_currency_by_code
from app.modules.transactions.errors import DraftNotFoundError, TransactionValidationError
from app.modules.transactions.models.transaction_draft_model import TransactionDraft
from app.modules.wallets import get_wallet_owned_by_user


def list_drafts_for_user(db: Session, user_id: uuid.UUID, status: str | None = "pending") -> list[TransactionDraft]:
    query = select(TransactionDraft).where(TransactionDraft.user_id == user_id)
    if status is not None:
        query = query.where(TransactionDraft.status == status)
    return list(db.scalars(query.order_by(TransactionDraft.created_at.desc())))


def get_draft_owned_by_user(db: Session, draft_id: uuid.UUID, user_id: uuid.UUID) -> TransactionDraft:
    draft = db.get(TransactionDraft, draft_id)
    if draft is None or draft.user_id != user_id:
        raise DraftNotFoundError("Borrador no encontrado")
    return draft


# Campos de un borrador que el usuario puede editar mientras sigue pendiente. La moneda
# se resuelve aparte (se guarda como FK, no como texto).
_EDITABLE_FIELDS = (
    "parsed_amount",
    "parsed_category",
    "parsed_description",
    "suggested_wallet_id",
    "txn_type",
    "occurred_at",
    "fee",
    "reference",
)


def update_draft(db: Session, draft_id: uuid.UUID, user_id: uuid.UUID, changes: dict) -> TransactionDraft:
    """Edita un borrador pendiente. Solo se tocan las claves presentes en `changes`
    (permite poner un campo en None a proposito, ej. quitar la billetera sugerida)."""
    draft = get_draft_owned_by_user(db, draft_id, user_id)
    if draft.status != "pending":
        raise TransactionValidationError("Solo se pueden editar borradores pendientes")

    if changes.get("suggested_wallet_id") is not None:
        get_wallet_owned_by_user(db, changes["suggested_wallet_id"], user_id)

    for field in _EDITABLE_FIELDS:
        if field in changes:
            setattr(draft, field, changes[field])
    if "parsed_currency" in changes:
        code = changes["parsed_currency"]
        draft.parsed_currency_id = get_currency_by_code(db, code).id if code else None

    db.commit()
    db.refresh(draft)
    return draft


def discard_draft(db: Session, draft_id: uuid.UUID, user_id: uuid.UUID) -> TransactionDraft:
    draft = get_draft_owned_by_user(db, draft_id, user_id)
    draft.status = "discarded"
    db.commit()
    db.refresh(draft)
    return draft
