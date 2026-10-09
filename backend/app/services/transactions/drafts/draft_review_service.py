import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.transactions.transaction_draft_model import TransactionDraft
from app.models.transactions.transaction_model import Transaction
from app.services.currency.currency_lookup import get_currency_by_code
from app.services.transactions.errors import DraftNotFoundError, TransactionValidationError
from app.services.transactions.transaction_service import create_transaction, warm_reference_rates
from app.services.wallets.errors import WalletNotFoundError
from app.services.wallets.transfer_service import FEE_CATEGORY, execute_transfer
from app.services.wallets.wallet_service import get_wallet_owned_by_user


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
    draft = _get_draft_owned_by_user(db, draft_id, user_id)
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


def confirm_draft(
    db: Session,
    draft_id: uuid.UUID,
    user_id: uuid.UUID,
    wallet_id: uuid.UUID,
    final_amount: Decimal,
    final_category: str,
    final_description: str | None,
    type: str,
    occurred_at: datetime | None = None,
    fee: Decimal | None = None,
) -> tuple[Transaction, TransactionDraft]:
    """Crea la transacción real (delega en transaction_service, que ya aplica el delta
    de saldo al wallet) y marca el draft como confirmado. Si trae comisión, se registra
    como su propio gasto "Comisión" en la misma billetera, todo en un solo commit."""
    draft = _get_draft_owned_by_user(db, draft_id, user_id)
    resolved_occurred_at = occurred_at or draft.occurred_at
    warm_reference_rates(db, user_id, [wallet_id])

    try:
        transaction = create_transaction(
            db,
            user_id=user_id,
            wallet_id=wallet_id,
            type=type,
            amount=final_amount,
            category=final_category,
            description=final_description,
            occurred_at=resolved_occurred_at,
            source=draft.source,
            commit=False,
        )
        if fee is not None and fee > 0:
            create_transaction(
                db,
                user_id=user_id,
                wallet_id=wallet_id,
                type="expense",
                amount=fee,
                category=FEE_CATEGORY,
                description=final_description,
                occurred_at=resolved_occurred_at,
                source=draft.source,
                commit=False,
            )
        draft.status = "confirmed"
        db.commit()
    except Exception:
        db.rollback()
        raise

    db.refresh(transaction)
    db.refresh(draft)
    return transaction, draft


def confirm_draft_as_transfer(
    db: Session,
    draft_id: uuid.UUID,
    user_id: uuid.UUID,
    from_wallet_id: uuid.UUID,
    to_wallet_id: uuid.UUID | None,
    sent_amount: Decimal,
    fee: Decimal = Decimal("0"),
    occurred_at: datetime | None = None,
) -> TransactionDraft:
    """Completa un pendiente como transferencia entre billeteras propias: el monto del
    borrador es lo que LLEGO a la billetera destino (ej. los Bs recibidos) y `sent_amount`
    lo que salio del origen (ej. los USDT) - el dato que el usuario no sabia al registrar
    la captura. La billetera destino sale del borrador si no se indica otra."""
    draft = _get_draft_owned_by_user(db, draft_id, user_id)
    if draft.status != "pending":
        raise TransactionValidationError("Solo se pueden completar borradores pendientes")
    if draft.parsed_amount is None:
        raise TransactionValidationError("El borrador no tiene monto")

    destination_id = to_wallet_id or draft.suggested_wallet_id
    if destination_id is None:
        raise WalletNotFoundError("Elige la billetera que recibió el dinero")

    # execute_transfer hace su propio commit; el borrador se marca despues. Si
    # execute_transfer falla (saldo insuficiente, monedas) no se toca el borrador.
    execute_transfer(
        db,
        user_id,
        from_wallet_id,
        destination_id,
        sent_amount,
        fee=fee,
        converted_amount=draft.parsed_amount,
        occurred_at=occurred_at or draft.occurred_at,
    )
    draft.status = "confirmed"
    db.commit()
    db.refresh(draft)
    return draft


def discard_draft(db: Session, draft_id: uuid.UUID, user_id: uuid.UUID) -> TransactionDraft:
    draft = _get_draft_owned_by_user(db, draft_id, user_id)
    draft.status = "discarded"
    db.commit()
    db.refresh(draft)
    return draft
