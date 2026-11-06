"""Editar un movimiento: revierte el efecto viejo en el saldo y aplica el nuevo."""

import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy.orm import Session

from app.modules.currency import reference_fields_in_usd
from app.modules.transactions.errors import TransactionValidationError
from app.modules.transactions.models.transaction_model import Transaction
from app.modules.wallets import Wallet


def update_transaction(
    db: Session,
    transaction_id: uuid.UUID,
    user_id: uuid.UUID,
    wallet_id: uuid.UUID,
    type: str,
    amount: Decimal,
    category: str,
    description: str | None,
    occurred_at: datetime,
) -> Transaction:
    """Edita un movimiento existente - pedido explícito del usuario ("se debe poder
    editar los movimientos... montos, fecha de pago, description, wallet_id,
    category"). Revierte el efecto de saldo ANTERIOR (misma lógica que
    _reverse_and_delete) antes de aplicar el nuevo - funciona igual si solo cambia el
    monto o si también cambia la wallet (la vieja se revierte, la nueva - puede ser la
    misma - recibe el nuevo delta; db.get() con el mismo id devuelve el mismo objeto de
    la identity map, así que ambos ajustes se acumulan correctamente sobre un único
    wallet cuando no cambia).

    Nunca sobre una pata de transferencia (transfer_id no nulo) - esas se editan como
    unidad completa desde su propio flujo, no una por una (ver wallets/services/transfers/);
    permitir editarlas acá dejaría el ledger de la transferencia inconsistente.

    reference_amount_usd se recalcula con la wallet/fecha NUEVAS (ver
    _reference_amount_in_usd) - si cambia la moneda o la fecha, el valor congelado debe
    reflejar eso, no quedar pegado al de antes de editar."""
    if amount <= 0:
        raise TransactionValidationError("El monto debe ser mayor a 0")
    if type not in ("income", "expense"):
        raise TransactionValidationError("type debe ser 'income' o 'expense'")

    transaction = db.get(Transaction, transaction_id)
    if transaction is None or transaction.user_id != user_id:
        raise TransactionValidationError("Transacción no encontrada o no pertenece al usuario")
    if transaction.transfer_id is not None:
        raise TransactionValidationError("No se puede editar una transferencia - elimínala y creala de nuevo")

    new_wallet = db.get(Wallet, wallet_id)
    if new_wallet is None or new_wallet.user_id != user_id:
        raise TransactionValidationError("Billetera no encontrada o no pertenece al usuario")

    old_wallet = db.get(Wallet, transaction.wallet_id)
    if old_wallet is not None:
        if transaction.type == "expense":
            old_wallet.balance += transaction.amount
        else:
            old_wallet.balance -= transaction.amount

    if type == "expense":
        new_wallet.balance -= amount
    else:
        new_wallet.balance += amount

    transaction.wallet_id = wallet_id
    transaction.currency_id = new_wallet.currency_id
    transaction.type = type
    transaction.amount = amount
    transaction.category = category
    transaction.description = description
    transaction.occurred_at = occurred_at
    transaction.reference_amount_usd, transaction.reference_rate = reference_fields_in_usd(
        db, amount, new_wallet.currency, occurred_at
    )

    db.commit()
    db.refresh(transaction)
    return transaction
