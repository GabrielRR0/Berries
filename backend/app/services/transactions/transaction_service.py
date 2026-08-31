import uuid
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.transactions.transaction_model import Transaction
from app.models.wallets.wallet_model import Wallet
from app.services.transactions.errors import TransactionValidationError


def create_transaction(
    db: Session,
    user_id: uuid.UUID,
    wallet_id: uuid.UUID,
    type: str,
    amount: Decimal,
    category: str,
    description: str | None = None,
    occurred_at: datetime | None = None,
    source: str = "manual",
) -> Transaction:
    """Crea la transacción y aplica su delta de saldo al wallet en la misma unidad de
    trabajo (un solo commit) — expense resta, income suma."""
    if amount <= 0:
        raise TransactionValidationError("El monto debe ser mayor a 0")
    if type not in ("income", "expense"):
        raise TransactionValidationError("type debe ser 'income' o 'expense'")

    wallet = db.get(Wallet, wallet_id)
    if wallet is None or wallet.user_id != user_id:
        raise TransactionValidationError("Billetera no encontrada o no pertenece al usuario")

    if type == "expense":
        wallet.balance -= amount
    else:
        wallet.balance += amount

    transaction = Transaction(
        user_id=user_id,
        wallet_id=wallet_id,
        type=type,
        amount=amount,
        category=category,
        description=description,
        occurred_at=occurred_at or datetime.now(timezone.utc),
        source=source,
    )
    db.add(transaction)
    db.commit()
    db.refresh(transaction)
    return transaction


def list_transactions_for_user(
    db: Session,
    user_id: uuid.UUID,
    wallet_id: uuid.UUID | None = None,
    category: str | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
) -> list[Transaction]:
    # "category" ya no se filtra en SQL: la columna esta encriptada (ver
    # app/core/encryption.py) y cada valor se cifra con un IV distinto, asi que dos
    # categorias iguales en texto plano NUNCA matchean por igualdad de ciphertext. Se
    # trae todo lo demas ya filtrado por SQL (wallet_id/fecha si escritos) y se filtra
    # por categoria en Python, ya con el valor decodificado por el ORM.
    query = select(Transaction).where(Transaction.user_id == user_id)
    if wallet_id is not None:
        query = query.where(Transaction.wallet_id == wallet_id)
    if date_from is not None:
        query = query.where(Transaction.occurred_at >= date_from)
    if date_to is not None:
        query = query.where(Transaction.occurred_at <= date_to)
    results = list(db.scalars(query.order_by(Transaction.occurred_at.desc())))
    if category is not None:
        results = [transaction for transaction in results if transaction.category == category]
    return results


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
        raise TransactionValidationError("Transacción no encontrada o no pertenece al usuario")

    if transaction.transfer_id is not None:
        siblings = db.scalars(
            select(Transaction).where(
                Transaction.transfer_id == transaction.transfer_id,
                Transaction.user_id == user_id,
            )
        )
        for sibling in siblings:
            _reverse_and_delete(db, sibling)
    else:
        _reverse_and_delete(db, transaction)

    db.commit()
