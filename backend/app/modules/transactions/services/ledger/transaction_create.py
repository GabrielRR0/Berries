"""Registrar movimientos (uno o varios) y aplicar su efecto en el saldo de la billetera."""

import uuid
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy.orm import Session

from app.modules.currency import reference_fields_in_usd
from app.modules.transactions.errors import TransactionValidationError
from app.modules.transactions.models.transaction_model import Transaction
from app.modules.transactions.utils.import_key import seal_import_key
from app.modules.wallets import Wallet


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
    commit: bool = True,
    import_key: str | None = None,
) -> Transaction:
    """Crea la transacción y aplica su delta de saldo al wallet en la misma unidad de
    trabajo (un solo commit) — expense resta, income suma.

    commit=False solo hace flush: quien crea varias a la vez (ver
    create_transactions_bulk) hace un unico commit al final para que un fallo a mitad
    no deje el lote a medias."""
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

    resolved_occurred_at = occurred_at or datetime.now(timezone.utc)
    reference_amount_usd, reference_rate = reference_fields_in_usd(db, amount, wallet.currency, resolved_occurred_at)
    transaction = Transaction(
        user_id=user_id,
        wallet_id=wallet_id,
        # Snapshot de una sola vez - un asiento ya ocurrido debe bastarse a sí mismo
        # para saber en qué moneda estaba, ver transaction_model.py.
        currency_id=wallet.currency_id,
        type=type,
        amount=amount,
        reference_amount_usd=reference_amount_usd,
        reference_rate=reference_rate,
        category=category,
        description=description,
        occurred_at=resolved_occurred_at,
        source=source,
        import_key=seal_import_key(user_id, import_key) if import_key else None,
    )
    db.add(transaction)
    if commit:
        db.commit()
    else:
        db.flush()
    db.refresh(transaction)
    return transaction


def warm_reference_rates(
    db: Session,
    user_id: uuid.UUID,
    wallet_ids: list[uuid.UUID],
    occurred_ats: list[datetime | None] | None = None,
) -> None:
    """Garantiza que existan las tasas a USD que se van a necesitar ANTES de tocar ningun
    saldo: la de ahora y la de cada fecha en que ocurrieron los movimientos (`occurred_ats`).
    Motivo: la primera vez que una moneda no-USD (ej. VEF) se convierte, o cuando falta el
    historico de esa fecha (ver ensure_vef_history_covers), se guardan tasas con su propio
    commit - y ese commit confirmaria a mitad de un lote los cambios de saldo ya hechos,
    rompiendo el "todo o nada". Best effort, igual que reference_fields_in_usd: si la API de
    tasas falla, el registro sigue (queda sin valor de referencia)."""
    now = datetime.now(timezone.utc)
    moments = {now}
    for occurred_at in occurred_ats or []:
        if occurred_at is not None:
            moments.add(occurred_at if occurred_at.tzinfo else occurred_at.replace(tzinfo=timezone.utc))
    currencies = set()
    for wallet_id in set(wallet_ids):
        wallet = db.get(Wallet, wallet_id)
        if wallet is not None and wallet.user_id == user_id:
            currencies.add(wallet.currency)
    for currency in currencies:
        for moment in moments:
            reference_fields_in_usd(db, Decimal("1"), currency, moment)


def create_transactions_bulk(
    db: Session,
    user_id: uuid.UUID,
    items: list[dict],
) -> list[Transaction]:
    """Crea varias transacciones de una sola vez: si una falla (billetera ajena, monto
    invalido) no se crea ninguna. Cada item son los kwargs de create_transaction."""
    warm_reference_rates(
        db, user_id, [item["wallet_id"] for item in items], [item.get("occurred_at") for item in items]
    )
    try:
        created = [create_transaction(db, user_id, commit=False, **item) for item in items]
        db.commit()
    except Exception:
        db.rollback()
        raise
    for transaction in created:
        db.refresh(transaction)
    return created
