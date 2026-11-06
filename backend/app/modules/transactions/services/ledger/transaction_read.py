"""Consultas de movimientos (sin efectos)."""

import uuid
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.transactions.contracts.resources import DuplicateCheckResource
from app.modules.transactions.models.transaction_model import Transaction
from app.modules.transactions.utils.import_key import seal_import_key


def find_existing_import_keys(db: Session, user_id: uuid.UUID, client_keys: list[str]) -> set[str]:
    """De los identificadores que manda el cliente, los que ya corresponden a un movimiento
    registrado por este usuario (ver seal_import_key)."""
    if not client_keys:
        return set()
    sealed_to_client = {seal_import_key(user_id, key): key for key in client_keys}
    found = db.scalars(
        select(Transaction.import_key).where(
            Transaction.user_id == user_id, Transaction.import_key.in_(list(sealed_to_client))
        )
    )
    return {sealed_to_client[sealed] for sealed in found if sealed in sealed_to_client}


def list_transactions_for_user(
    db: Session,
    user_id: uuid.UUID,
    wallet_id: uuid.UUID | None = None,
    category: str | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
) -> list[Transaction]:
    # "category" ya no se filtra en SQL: la columna esta encriptada (ver
    # app/common/crypto/encrypted_types.py) y cada valor se cifra con un IV distinto, asi que dos
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


def check_duplicates(db: Session, user_id: uuid.UUID, keys: list[str]) -> DuplicateCheckResource:
    """Lo que devuelve POST /transactions/duplicates: cuales de las claves de
    importacion que manda el cliente ya fueron registradas, en el mismo orden."""
    found = find_existing_import_keys(db, user_id, keys)
    return DuplicateCheckResource(duplicates=[key for key in keys if key in found])
