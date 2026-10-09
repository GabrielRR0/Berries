import uuid
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.currency.exchange_rate_model import ExchangeRate
from app.models.transactions.transaction_model import Transaction
from app.models.wallets.wallet_model import Wallet
from app.services.currency.currency_service import reference_fields_in_usd
from app.services.transactions.errors import TransactionValidationError
from app.services.transactions.import_key import seal_import_key

# Tolerancia para decidir si un reference_amount_usd ya guardado "difiere" del
# recalculado en backfill_reference_amounts - en la práctica la aritmética es toda
# Decimal (sin floats), así que una diferencia real del bug corregido es varios
# órdenes de magnitud mayor a esto; existe solo para no reventar por ruido de
# redondeo si alguna vez lo hay.
_RECONCILE_TOLERANCE = Decimal("0.000001")


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
        # La observación de tasa implícita que esa transferencia haya congelado (ver
        # transfer_service._record_transfer_rate_observation) no debe sobrevivir a la
        # transferencia que la originó - dejarla sería una tasa "huérfana" en el
        # historial de una operación que ya no existe.
        for rate_row in db.scalars(select(ExchangeRate).where(ExchangeRate.transfer_id == transaction.transfer_id)):
            db.delete(rate_row)
    else:
        _reverse_and_delete(db, transaction)

    db.commit()


def backfill_reference_amounts(db: Session, *, dry_run: bool = False) -> dict[str, object]:
    """Backfill + RECONCILIACIÓN de los campos derivados de moneda de transactions
    viejas (currency_id/reference_amount_usd/reference_rate) - ver la sección "Qué pasa
    con los usuarios/datos que ya existen en producción" del plan de arreglo de sumas
    de moneda. Pedido explícito del usuario, con captura real: en Movimientos vio
    transacciones viejas en VEF sin ningún valor de referencia, y no quiere que un
    cambio grande como este deje a clientes viejos con datos desactualizados/rotos, tal
    como pasó una vez antes.

    Tres pasos, todos idempotentes, sobre TODAS las transactions del sistema (no de un
    usuario en particular) - pensado para invocarse desde manage.py, no desde un
    endpoint de usuario:
    1. `currency_id` NULL -> se rellena desde la wallet actual (snapshot de una sola
       vez, nunca se vuelve a derivar después de esto).
    2. Para cada transaction no-USD, se recalcula reference_fields_in_usd con la
       lógica YA CORREGIDA de get_rate_at (usa el occurred_at PROPIO de cada fila, no
       "ahora"). Si `reference_amount_usd` guardado es NULL, se rellena con lo
       recalculado.
    3. Si `reference_amount_usd` YA tenía un valor pero difiere del recalculado (más
       allá de _RECONCILE_TOLERANCE) - el caso de una fila que se congeló usando el
       fallback roto de get_rate_at, antes de este arreglo - se SOBRESCRIBE con el
       valor correcto y la fila queda en el reporte de cambios (`changes`), nunca se
       pisa en silencio. Si coincide, no se toca nada.

    `dry_run=True` hace todo el trabajo real (incluida la comparación) pero termina en
    rollback en vez de commit - para correr esto primero contra una copia de
    producción y revisar el reporte antes de tocar datos reales."""
    transactions = list(db.scalars(select(Transaction)))
    currency_id_filled = 0
    reference_filled = 0
    changes: list[dict[str, object]] = []

    for transaction in transactions:
        wallet = db.get(Wallet, transaction.wallet_id)
        if wallet is None:
            continue

        if transaction.currency_id is None:
            transaction.currency_id = wallet.currency_id
            currency_id_filled += 1

        if wallet.currency == "USD":
            continue

        recalculated_amount, recalculated_rate = reference_fields_in_usd(
            db, transaction.amount, wallet.currency, transaction.occurred_at
        )
        if recalculated_amount is None:
            continue

        if transaction.reference_amount_usd is None:
            transaction.reference_amount_usd = recalculated_amount
            transaction.reference_rate = recalculated_rate
            reference_filled += 1
        elif abs(transaction.reference_amount_usd - recalculated_amount) > _RECONCILE_TOLERANCE:
            changes.append(
                {
                    "transaction_id": str(transaction.id),
                    "user_id": str(transaction.user_id),
                    "currency": wallet.currency,
                    "old_reference_amount_usd": transaction.reference_amount_usd,
                    "new_reference_amount_usd": recalculated_amount,
                }
            )
            transaction.reference_amount_usd = recalculated_amount
            transaction.reference_rate = recalculated_rate

    if dry_run:
        db.rollback()
    else:
        db.commit()

    return {
        "currency_id_filled": currency_id_filled,
        "reference_filled": reference_filled,
        "reference_reconciled": len(changes),
        "changes": changes,
    }
