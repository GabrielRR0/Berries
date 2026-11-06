"""Confirmar un borrador: lo convierte en movimiento o en transferencia."""

import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy.orm import Session

from app.modules.transactions.errors import TransactionValidationError
from app.modules.transactions.models.transaction_draft_model import TransactionDraft
from app.modules.transactions.models.transaction_model import Transaction
from app.modules.transactions.services.drafts.draft_review import get_draft_owned_by_user
from app.modules.transactions.services.ledger.transaction_create import create_transaction, warm_reference_rates
from app.modules.wallets import FEE_CATEGORY, execute_transfer
from app.modules.wallets import WalletNotFoundError


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
    """Crea la transacción real (delega en transactions/services/ledger, que ya aplica el delta
    de saldo al wallet) y marca el draft como confirmado. Si trae comisión, se registra
    como su propio gasto "Comisión" en la misma billetera, todo en un solo commit."""
    draft = get_draft_owned_by_user(db, draft_id, user_id)
    resolved_occurred_at = occurred_at or draft.occurred_at
    warm_reference_rates(db, user_id, [wallet_id], [resolved_occurred_at])

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
    draft = get_draft_owned_by_user(db, draft_id, user_id)
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
