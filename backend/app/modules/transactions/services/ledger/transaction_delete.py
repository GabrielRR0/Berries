"""Borrar un movimiento (o una transferencia completa) revirtiendo su efecto en el saldo."""

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.currency import ExchangeRate
from app.modules.transactions.errors import TransactionNotFoundError
from app.modules.transactions.models.transaction_model import Transaction
from app.modules.wallets import Wallet


def _reverse_and_delete(db: Session, transaction: Transaction) -> None:
    wallet = db.get(Wallet, transaction.wallet_id)
    if wallet is not None:
        if transaction.type == "expense":
            wallet.balance += transaction.amount
        else:
            wallet.balance -= transaction.amount

    db.delete(transaction)


def delete_transaction(db: Session, transaction_id: uuid.UUID, user_id: uuid.UUID) -> None:
    """Revierte el delta de saldo aplicado al crear la transacción antes de borrarla.

    Si la transacción viene de una transferencia (`transfer_id` no nulo, ver
    transfer_service.py), borra las DOS patas juntas (mismo transfer_id) revirtiendo
    ambos saldos en el mismo commit - eliminar solo una mitad dejaria el ledger
    inconsistente (plata "desaparecida" de un wallet sin haber llegado nunca al otro)."""
    transaction = db.get(Transaction, transaction_id)
    if transaction is None or transaction.user_id != user_id:
        raise TransactionNotFoundError("Transacción no encontrada o no pertenece al usuario")

    if transaction.transfer_id is not None:
        siblings = db.scalars(
            select(Transaction).where(
                Transaction.transfer_id == transaction.transfer_id,
                Transaction.user_id == user_id,
            )
        )
        for sibling in siblings:
            _reverse_and_delete(db, sibling)
        # La observación de tasa implícita que esa transferencia haya congelado (ver
        # transfer_service._record_transfer_rate_observation) no debe sobrevivir a la
        # transferencia que la originó - dejarla sería una tasa "huérfana" en el
        # historial de una operación que ya no existe.
        for rate_row in db.scalars(select(ExchangeRate).where(ExchangeRate.transfer_id == transaction.transfer_id)):
            db.delete(rate_row)
    else:
        _reverse_and_delete(db, transaction)

    db.commit()
