"""Rellena o corrige el valor de referencia en USD de movimientos viejos (comando de manage.py)."""

from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.currency import reference_fields_in_usd
from app.modules.transactions.models.transaction_model import Transaction
from app.modules.wallets import Wallet


# Tolerancia para decidir si un reference_amount_usd ya guardado "difiere" del
# recalculado en backfill_reference_amounts - en la práctica la aritmética es toda
# Decimal (sin floats), así que una diferencia real del bug corregido es varios
# órdenes de magnitud mayor a esto; existe solo para no reventar por ruido de
# redondeo si alguna vez lo hay.
_RECONCILE_TOLERANCE = Decimal("0.000001")


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
