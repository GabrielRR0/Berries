import uuid
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.transactions.transaction_model import Transaction
from app.models.wallets.wallet_model import Wallet
from app.services.currency.currency_service import convert_at
from app.services.transactions.errors import TransactionValidationError


def _reference_amount_in_usd(db: Session, amount: Decimal, currency: str, occurred_at: datetime) -> Decimal | None:
    """Valor congelado en USD al momento en que OCURRIÓ la transacción (no en el que se
    registra: un movimiento se puede backdatear, ver TransactionForm.vue) - pedido
    explícito del usuario: para una wallet en una moneda nacional con inflación fuerte
    (VEF, COP, ARS...) quiere un registro FIJO de "cuánto era eso ese día", que nunca
    cambie aunque la tasa de cambio se siga moviendo después. convert_at (no convert)
    para que un gasto backdateado use SU propia tasa histórica, no la de hoy - mismo
    criterio que analytics_service.py. None si la wallet ya está en USD (el propio
    amount ya es la referencia) o si la conversión falla - best-effort, un problema
    pasajero con la API de tasas no debe impedir registrar el movimiento."""
    if currency == "USD":
        return None
    try:
        return convert_at(db, amount, currency, "USD", occurred_at)
    except Exception:
        return None


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

    resolved_occurred_at = occurred_at or datetime.now(timezone.utc)
    transaction = Transaction(
        user_id=user_id,
        wallet_id=wallet_id,
        type=type,
        amount=amount,
        reference_amount_usd=_reference_amount_in_usd(db, amount, wallet.currency, resolved_occurred_at),
        category=category,
        description=description,
        occurred_at=resolved_occurred_at,
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
    unidad completa desde su propio flujo, no una por una (ver transfer_service.py);
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
    transaction.type = type
    transaction.amount = amount
    transaction.category = category
    transaction.description = description
    transaction.occurred_at = occurred_at
    transaction.reference_amount_usd = _reference_amount_in_usd(db, amount, new_wallet.currency, occurred_at)

    db.commit()
    db.refresh(transaction)
    return transaction


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


def backfill_reference_amounts(db: Session) -> int:
    """Rellena reference_amount_usd para transactions que quedaron en NULL - creadas
    antes de que este campo existiera (ver create_transaction). Pedido explícito del
    usuario, con captura real: en Movimientos vio transacciones viejas en VEF sin
    ningún valor de referencia. Usa el occurred_at PROPIO de cada transaction (no
    "ahora") vía _reference_amount_in_usd/convert_at - reaprovecha el historial real de
    ExchangeRate que ya exista para esa fecha, o cae a la tasa más vieja disponible si
    no hay ninguna anterior (mismo criterio que create_transaction/analytics_service.py).

    Corre sobre TODAS las transactions del sistema (no de un usuario particular) - es
    un backfill de una sola vez para datos que ya existían antes de este campo, pensado
    para invocarse desde manage.py, no desde un endpoint de usuario. Idempotente:
    filtra por reference_amount_usd IS NULL, así que correrlo de nuevo no toca las
    filas ya rellenadas."""
    transactions = list(db.scalars(select(Transaction).where(Transaction.reference_amount_usd.is_(None))))
    updated = 0
    for transaction in transactions:
        wallet = db.get(Wallet, transaction.wallet_id)
        if wallet is None or wallet.currency == "USD":
            continue
        reference = _reference_amount_in_usd(db, transaction.amount, wallet.currency, transaction.occurred_at)
        if reference is not None:
            transaction.reference_amount_usd = reference
            updated += 1
    db.commit()
    return updated
