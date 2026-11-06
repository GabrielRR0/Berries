"""Piezas comunes de los cálculos: movimientos de un período y sumas convertidas a la moneda del usuario."""

import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.modules.analytics.utils.months import month_bounds
from app.modules.auth import User
from app.modules.currency import get_conversion_rate, reference_fields_in_usd
from app.modules.transactions import Transaction
from app.modules.wallets import Wallet


class WalletCurrencyConverter:
    """Convierte el monto de una transacción a `target_currency`, leyendo el valor ya
    congelado por transaction_service.py (`transaction.reference_amount_usd`) en vez de
    recalcular una tasa histórica en cada consulta - ver docstring del módulo. Memoiza
    el mapa wallet->moneda (solo como respaldo, ver más abajo) y la tasa USD->target
    (una sola, no por transacción/día - el salto final es siempre en vivo). Se crea UNA
    vez por llamada pública de este módulo y se reusa en todas sus sumas/agrupaciones
    internas."""

    def __init__(self, db: Session, user_id: uuid.UUID, target_currency: str) -> None:
        self._db = db
        self._target_currency = target_currency
        self._usd_to_target_rate: Decimal | None = None
        wallets = db.scalars(
            select(Wallet).options(joinedload(Wallet.currency_ref)).where(Wallet.user_id == user_id)
        )
        self._currency_by_wallet_id: dict[uuid.UUID, str] = {wallet.id: wallet.currency for wallet in wallets}

    def _usd_to_target(self) -> Decimal:
        if self._target_currency == "USD":
            return Decimal("1")
        if self._usd_to_target_rate is None:
            self._usd_to_target_rate = get_conversion_rate(self._db, "USD", self._target_currency)
        return self._usd_to_target_rate

    def amount_of(self, transaction: Transaction) -> Decimal:
        # transaction.currency (snapshot propio) es la fuente normal; el mapa por
        # wallet_id queda solo como respaldo para filas viejísimas que el backfill
        # todavía no alcanzó a poblar (currency_id NULL) - ver
        # transaction_service.backfill_reference_amounts.
        currency = transaction.currency or self._currency_by_wallet_id.get(
            transaction.wallet_id, self._target_currency
        )
        if currency == self._target_currency:
            return transaction.amount

        if currency == "USD":
            usd_value = transaction.amount
        else:
            usd_value = transaction.reference_amount_usd
            if usd_value is None:
                # Self-heal: fila que el backfill no alcanzó a cubrir (ej. wallet
                # borrada entre medio) o cuya conversión falló en su momento -
                # calcular UNA vez con la fecha real de la transacción y persistir,
                # en vez de tratarla como 0 (eso sí sería el mismo tipo de "suma que
                # no cuadra" que motivó todo este cambio) o reventar el request.
                usd_value, rate = reference_fields_in_usd(
                    self._db, transaction.amount, currency, transaction.occurred_at
                )
                if usd_value is None:
                    return Decimal("0")
                transaction.reference_amount_usd = usd_value
                transaction.reference_rate = rate
                self._db.commit()

        if self._target_currency == "USD":
            return usd_value
        return usd_value * self._usd_to_target()


def user_default_currency(db: Session, user_id: uuid.UUID) -> str:
    user = db.get(User, user_id)
    return user.default_currency if user else "USD"


def transactions_in_range(db: Session, user_id: uuid.UUID, kind: str, start: datetime, end: datetime) -> list[Transaction]:
    # source != "transfer" excluye las dos patas que crea una transferencia entre
    # wallets propias (ver transfer_service.py) - mover plata de una wallet a otra no es
    # ingreso ni gasto real, mismo criterio que ya aplica el frontend a mano en
    # IncomeExpenseSummary.vue/TransactionsMain.vue. La comision de una transferencia SI
    # se incluye (se crea con source="manual", ver transfer_service.py) porque esa si es
    # un gasto real.
    #
    # joinedload(Transaction.currency_ref): WalletCurrencyConverter.amount_of() lee
    # transaction.currency por fila - sin precargar la relación, cada acceso dispararía
    # su propio SELECT perezoso (N+1) en vez de traer todo en esta única consulta.
    return list(
        db.scalars(
            select(Transaction)
            .options(joinedload(Transaction.currency_ref))
            .where(
                Transaction.user_id == user_id,
                Transaction.type == kind,
                Transaction.source != "transfer",
                Transaction.occurred_at >= start,
                Transaction.occurred_at < end,
            )
        )
    )


def sum_amount(
    db: Session, user_id: uuid.UUID, kind: str, start: datetime, end: datetime, converter: WalletCurrencyConverter
) -> Decimal:
    rows = transactions_in_range(db, user_id, kind, start, end)
    return sum((converter.amount_of(row) for row in rows), Decimal("0"))


def net_savings_for_month(
    db: Session, user_id: uuid.UUID, month: str, converter: WalletCurrencyConverter
) -> Decimal:
    start, end = month_bounds(month)
    income = sum_amount(db, user_id, "income", start, end, converter)
    expense = sum_amount(db, user_id, "expense", start, end, converter)
    return income - expense
