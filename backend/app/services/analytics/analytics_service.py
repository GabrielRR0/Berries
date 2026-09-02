"""Capa de agregación de solo lectura sobre `Transaction` (sección 3.7 de la spec:
resúmenes financieros). No crea ninguna tabla propia — todo se calcula on-demand a
partir del ledger y las wallets ya existentes, siempre acotado al usuario dueño de la
sesión (nunca se agrega across usuarios).

`amount`/`category` están encriptados a nivel de columna (ver app/core/encryption.py) -
el ciphertext no es sumable ni agrupable en SQL (cada valor se cifra con un IV
distinto, ni siquiera categorías iguales dan el mismo texto), así que las sumas/
agrupaciones que antes vivían en la query (func.sum/group_by) ahora se hacen en Python
sobre las filas ya traídas y decodificadas por el ORM. Los filtros de user_id/type/
fecha SÍ siguen resolviéndose en SQL (esas columnas quedaron sin encriptar a
propósito, ver transaction_model.py).

Conversión de moneda (bug real reportado por el usuario, con captura): `Transaction` no
guarda su propia moneda (solo `wallet_id`) - antes esto sumaba `amount` crudo de TODAS
las wallets del usuario sin importar su moneda, así que alguien con una wallet en VEF y
otra en USD veía, por ejemplo, "5.560 VEF de gasto" mostrado como "$5,560.00" (como si
fuera USD). Ahora cada fila se convierte a `User.default_currency` (la wallet.currency
de origen, resuelta vía `_WalletCurrencyConverter`) antes de sumar/agrupar - todo
`get_*` de este módulo devuelve montos ya en esa única moneda.

Segunda vuelta del mismo bug, tambien reportada por el usuario: convertir con la tasa
de HOY un gasto de hace varios meses en una moneda con inflación fuerte (ej. VEF)
reescribe su valor histórico cada vez que la tasa se mueve (3.000 VEF de hace un mes
valían más dólares que hoy). _WalletCurrencyConverter ahora resuelve la tasa vigente en
la fecha de CADA transacción (transaction.occurred_at, vía
currency_service.get_conversion_rate_at), no la tasa actual - así "Últimos 6 meses"/
"Ahorro acumulado" no le cambian el pasado a un mes ya cerrado."""

import re
import uuid
from collections import defaultdict
from datetime import date, datetime, timezone
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.models.auth.user_model import User
from app.models.transactions.transaction_model import Transaction
from app.models.wallets.wallet_model import Wallet
from app.schemas.analytics.analytics_schemas import (
    CategoryBreakdownItem,
    CategoryMonthlyTrendItem,
    CategoryMonthlyTrendResponse,
    MonthlyComparisonItem,
    PeriodSummaryResponse,
)
from app.services.analytics.errors import InvalidPeriodError
from app.services.currency.currency_service import get_conversion_rate_at

_OTHER_CATEGORY_LABEL = "Otros"


class _WalletCurrencyConverter:
    """Convierte el monto de una transacción a `target_currency`, resolviendo la
    moneda de origen a partir de su wallet_id y la TASA vigente en la fecha de esa
    transacción (nunca la tasa de hoy - ver docstring del módulo). Memoiza tanto el
    mapa wallet->moneda como la tasa por (moneda, día) - una consulta de wallets + una
    tasa por cada combinación distinta de moneda/día encontrada, nunca una tasa por
    transacción individual - se crea UNA vez por llamada pública de este módulo y se
    reusa en todas sus sumas/agrupaciones internas."""

    def __init__(self, db: Session, user_id: uuid.UUID, target_currency: str) -> None:
        self._db = db
        self._target_currency = target_currency
        self._rate_by_currency_and_day: dict[tuple[str, date], Decimal] = {}
        wallets = db.scalars(
            select(Wallet).options(joinedload(Wallet.currency_ref)).where(Wallet.user_id == user_id)
        )
        self._currency_by_wallet_id: dict[uuid.UUID, str] = {wallet.id: wallet.currency for wallet in wallets}

    def amount_of(self, transaction: Transaction) -> Decimal:
        # Una wallet borrada despues de crear la transaccion (si alguna vez fuera
        # posible) cae a target_currency (tasa 1) en vez de reventar - mismo
        # criterio "best-effort" que BalanceCard.vue en el frontend.
        currency = self._currency_by_wallet_id.get(transaction.wallet_id, self._target_currency)
        if currency == self._target_currency:
            return transaction.amount

        cache_key = (currency, transaction.occurred_at.date())
        if cache_key not in self._rate_by_currency_and_day:
            self._rate_by_currency_and_day[cache_key] = get_conversion_rate_at(
                self._db, currency, self._target_currency, transaction.occurred_at
            )
        return transaction.amount * self._rate_by_currency_and_day[cache_key]


def _default_currency(db: Session, user_id: uuid.UUID) -> str:
    user = db.get(User, user_id)
    return user.default_currency if user else "USD"

_MONTH_PATTERN = re.compile(r"^\d{4}-(0[1-9]|1[0-2])$")


def _resolve_month(month: str | None) -> str:
    """Devuelve `month` validado, o el mes calendario actual (UTC) si no se pasó uno."""
    if month is None:
        now = datetime.now(timezone.utc)
        return f"{now.year:04d}-{now.month:02d}"
    if not _MONTH_PATTERN.match(month):
        raise InvalidPeriodError(f"Formato de mes inválido: {month!r} (esperado 'YYYY-MM')")
    return month


def _parse_month(month: str) -> tuple[int, int]:
    year_str, month_str = month.split("-")
    return int(year_str), int(month_str)


def _month_bounds(month: str) -> tuple[datetime, datetime]:
    """Rango [inicio, fin) en UTC que cubre el mes calendario 'YYYY-MM' dado."""
    year, month_num = _parse_month(month)
    start = datetime(year, month_num, 1, tzinfo=timezone.utc)
    if month_num == 12:
        end = datetime(year + 1, 1, 1, tzinfo=timezone.utc)
    else:
        end = datetime(year, month_num + 1, 1, tzinfo=timezone.utc)
    return start, end


def _shift_month(month: str, delta: int) -> str:
    """Desplaza 'YYYY-MM' por `delta` meses (negativo = hacia atrás en el tiempo)."""
    year, month_num = _parse_month(month)
    total = year * 12 + (month_num - 1) + delta
    new_year, zero_based_month = divmod(total, 12)
    return f"{new_year:04d}-{zero_based_month + 1:02d}"


def _transactions_in_range(db: Session, user_id: uuid.UUID, kind: str, start: datetime, end: datetime) -> list[Transaction]:
    # source != "transfer" excluye las dos patas que crea una transferencia entre
    # wallets propias (ver transfer_service.py) - mover plata de una wallet a otra no es
    # ingreso ni gasto real, mismo criterio que ya aplica el frontend a mano en
    # IncomeExpenseSummary.vue/TransactionsMain.vue. La comision de una transferencia SI
    # se incluye (se crea con source="manual", ver transfer_service.py) porque esa si es
    # un gasto real.
    return list(
        db.scalars(
            select(Transaction).where(
                Transaction.user_id == user_id,
                Transaction.type == kind,
                Transaction.source != "transfer",
                Transaction.occurred_at >= start,
                Transaction.occurred_at < end,
            )
        )
    )


def _sum_amount(
    db: Session, user_id: uuid.UUID, kind: str, start: datetime, end: datetime, converter: _WalletCurrencyConverter
) -> Decimal:
    rows = _transactions_in_range(db, user_id, kind, start, end)
    return sum((converter.amount_of(row) for row in rows), Decimal("0"))


def _net_savings_for_month(
    db: Session, user_id: uuid.UUID, month: str, converter: _WalletCurrencyConverter
) -> Decimal:
    start, end = _month_bounds(month)
    income = _sum_amount(db, user_id, "income", start, end, converter)
    expense = _sum_amount(db, user_id, "expense", start, end, converter)
    return income - expense


def get_period_summary(db: Session, user_id: uuid.UUID, month: str | None = None) -> PeriodSummaryResponse:
    """Totales de ingreso/gasto/ahorro neto del mes dado (o el actual), más el ahorro
    neto del mes calendario inmediatamente anterior para el delta mes-a-mes. Todos los
    montos quedan convertidos a User.default_currency (ver _WalletCurrencyConverter)."""
    resolved_month = _resolve_month(month)
    start, end = _month_bounds(resolved_month)
    converter = _WalletCurrencyConverter(db, user_id, _default_currency(db, user_id))

    total_income = _sum_amount(db, user_id, "income", start, end, converter)
    total_expense = _sum_amount(db, user_id, "expense", start, end, converter)
    net_savings = total_income - total_expense

    previous_month = _shift_month(resolved_month, -1)
    previous_period_net_savings = _net_savings_for_month(db, user_id, previous_month, converter)

    return PeriodSummaryResponse(
        period=resolved_month,
        total_income=total_income,
        total_expense=total_expense,
        net_savings=net_savings,
        previous_period_net_savings=previous_period_net_savings,
    )


def get_category_breakdown(
    db: Session, user_id: uuid.UUID, kind: str, month: str | None = None
) -> list[CategoryBreakdownItem]:
    """Desglose por categoría de un `kind` ("income"/"expense") en el mes dado (o el
    actual), ordenado descendente por total. `percentage` es la participación de cada
    categoría sobre el total de ese type+month; 0.0 para todas si ese total es 0 (nunca
    división por cero)."""
    resolved_month = _resolve_month(month)
    start, end = _month_bounds(resolved_month)
    converter = _WalletCurrencyConverter(db, user_id, _default_currency(db, user_id))

    rows = _transactions_in_range(db, user_id, kind, start, end)

    totals_by_category: dict[str, Decimal] = defaultdict(lambda: Decimal("0"))
    for row in rows:
        totals_by_category[row.category] += converter.amount_of(row)

    totals = list(totals_by_category.items())
    grand_total = sum((total for _, total in totals), Decimal("0"))

    items = [
        CategoryBreakdownItem(
            category=category,
            total=total,
            percentage=float(total / grand_total * 100) if grand_total > 0 else 0.0,
        )
        for category, total in totals
    ]
    items.sort(key=lambda item: item.total, reverse=True)
    return items


def get_monthly_comparison(db: Session, user_id: uuid.UUID, months: int = 6) -> list[MonthlyComparisonItem]:
    """Una entrada por mes calendario, de más antiguo a más reciente, terminando en el
    mes actual — exactamente `months` meses consecutivos, incluyendo los que no
    tuvieron transacciones (con totales en cero, nunca se omiten)."""
    months = max(1, min(months, 24))
    current_month = _resolve_month(None)
    ordered_months = [_shift_month(current_month, -offset) for offset in range(months - 1, -1, -1)]
    converter = _WalletCurrencyConverter(db, user_id, _default_currency(db, user_id))

    items = []
    for month in ordered_months:
        start, end = _month_bounds(month)
        total_income = _sum_amount(db, user_id, "income", start, end, converter)
        total_expense = _sum_amount(db, user_id, "expense", start, end, converter)
        items.append(
            MonthlyComparisonItem(
                month=month,
                total_income=total_income,
                total_expense=total_expense,
                net=total_income - total_expense,
            )
        )
    return items


def get_category_monthly_trend(
    db: Session, user_id: uuid.UUID, kind: str, months: int = 6, top_n: int = 5
) -> CategoryMonthlyTrendResponse:
    """Cuánto se movió cada categoría mes a mes en la ventana pedida (ej. "cuánto gasté
    en Mercado cada uno de los últimos 6 meses") — a diferencia de get_category_breakdown
    (un solo mes, forma de torta), acá se repite la misma agrupación por categoría una
    vez por cada mes de la ventana. Solo se devuelven las `top_n` categorías con mayor
    total ACUMULADO en toda la ventana, una por una; el resto se junta en una única
    entrada "Otros" para que la lista se mantenga legible (un usuario con 20+
    categorías no debería ver 20+ filas de sparkline)."""
    months = max(1, min(months, 24))
    current_month = _resolve_month(None)
    ordered_months = [_shift_month(current_month, -offset) for offset in range(months - 1, -1, -1)]
    converter = _WalletCurrencyConverter(db, user_id, _default_currency(db, user_id))

    totals_by_month: list[dict[str, Decimal]] = []
    grand_totals: dict[str, Decimal] = defaultdict(lambda: Decimal("0"))

    for month in ordered_months:
        start, end = _month_bounds(month)
        rows = _transactions_in_range(db, user_id, kind, start, end)
        month_totals: dict[str, Decimal] = defaultdict(lambda: Decimal("0"))
        for row in rows:
            converted = converter.amount_of(row)
            month_totals[row.category] += converted
            grand_totals[row.category] += converted
        totals_by_month.append(month_totals)

    ranked_categories = sorted(grand_totals.items(), key=lambda entry: entry[1], reverse=True)
    top_categories = [category for category, _ in ranked_categories[:top_n]]
    other_categories = [category for category, _ in ranked_categories[top_n:]]

    items = [
        CategoryMonthlyTrendItem(
            category=category,
            monthly_totals=[month_totals.get(category, Decimal("0")) for month_totals in totals_by_month],
        )
        for category in top_categories
    ]

    if other_categories:
        items.append(
            CategoryMonthlyTrendItem(
                category=_OTHER_CATEGORY_LABEL,
                monthly_totals=[
                    sum((month_totals.get(category, Decimal("0")) for category in other_categories), Decimal("0"))
                    for month_totals in totals_by_month
                ],
            )
        )

    return CategoryMonthlyTrendResponse(months=ordered_months, categories=items)
