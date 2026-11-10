"""Capa de agregación de solo lectura sobre `Transaction` (sección 3.7 de la spec:
resúmenes financieros). No crea ninguna tabla propia — todo se calcula on-demand a
partir del ledger y las wallets ya existentes, siempre acotado al usuario dueño de la
sesión (nunca se agrega across usuarios). Nota: `WalletCurrencyConverter.amount_of()`
puede escribir (un self-heal puntual, ver su docstring) - no es 100% de solo lectura.

`amount`/`category` están encriptados a nivel de columna (ver app/common/crypto/encrypted_types.py) -
el ciphertext no es sumable ni agrupable en SQL (cada valor se cifra con un IV
distinto, ni siquiera categorías iguales dan el mismo texto), así que las sumas/
agrupaciones que antes vivían en la query (func.sum/group_by) ahora se hacen en Python
sobre las filas ya traídas y decodificadas por el ORM. Los filtros de user_id/type/
fecha SÍ siguen resolviéndose en SQL (esas columnas quedaron sin encriptar a
propósito, ver transaction_model.py).

Conversión de moneda - fuente única de verdad (ver currency/services/, regla
IAS 21/ASC 830 documentada ahí): cada `Transaction` ya sabe su propia moneda
(`transaction.currency`, snapshot congelado al crear/editar) y, si no es USD, ya trae
`reference_amount_usd` - el valor en USD congelado UNA vez con la tasa vigente en
`occurred_at`, la fecha real de la transacción. `WalletCurrencyConverter` lee ese valor
directo en vez de recalcular una tasa histórica en cada consulta - esto es lo que
garantiza que Análisis, Inicio, Movimientos y la etiqueta "≈$X al momento" de cada fila
muestren SIEMPRE el mismo número para la misma transacción, en vez de tres cálculos
independientes que podían no coincidir entre sí (bug real reportado por el usuario).
Solo el salto final USD -> `target_currency` (la moneda de despliegue, si no es USD) usa
una tasa EN VIVO - USD/EUR/USDT no tienen el problema de inflación que motiva congelar
la tasa histórica, así que ese último tramo puede resolverse con la tasa de hoy sin
distorsionar nada."""

import uuid

from sqlalchemy.orm import Session

from app.modules.analytics.contracts.resources import MonthlyComparisonItemResource, PeriodSummaryResource
from app.modules.analytics.services.period_totals import (
    WalletCurrencyConverter,
    month_exists,
    net_savings_for_month,
    registration_day,
    sum_amount,
    user_default_currency,
)
from app.modules.analytics.utils.months import month_bounds, resolve_month, shift_month


def get_period_summary(db: Session, user_id: uuid.UUID, month: str | None = None) -> PeriodSummaryResource:
    """Totales de ingreso/gasto/ahorro neto del mes dado (o el actual), más el ahorro
    neto del mes calendario inmediatamente anterior para el delta mes-a-mes. Todos los
    montos quedan convertidos a User.default_currency (ver WalletCurrencyConverter)."""
    resolved_month = resolve_month(month)
    start, end = month_bounds(resolved_month)
    converter = WalletCurrencyConverter(db, user_id, user_default_currency(db, user_id))

    total_income = sum_amount(db, user_id, "income", start, end, converter)
    total_expense = sum_amount(db, user_id, "expense", start, end, converter)
    net_savings = total_income - total_expense

    # None si el mes anterior terminó antes de que el usuario se registrara: no hay con qué comparar.
    registered = registration_day(db, user_id)
    previous_month = shift_month(resolved_month, -1)
    previous_period_net_savings = (
        net_savings_for_month(db, user_id, previous_month, converter) if month_exists(previous_month, registered) else None
    )

    return PeriodSummaryResource(
        period=resolved_month,
        total_income=total_income,
        total_expense=total_expense,
        net_savings=net_savings,
        previous_period_net_savings=previous_period_net_savings,
    )


def get_monthly_comparison(db: Session, user_id: uuid.UUID, months: int = 6) -> list[MonthlyComparisonItemResource]:
    """Una entrada por mes calendario, de más antiguo a más reciente, terminando en el
    mes actual — hasta `months` meses consecutivos desde que el usuario se
    registró, incluyendo los que no tuvieron transacciones (con totales en cero)."""
    months = max(1, min(months, 24))
    current_month = resolve_month(None)
    registered = registration_day(db, user_id)
    # Sin meses anteriores al registro (el mes actual siempre queda).
    ordered_months = [
        month
        for month in (shift_month(current_month, -offset) for offset in range(months - 1, -1, -1))
        if month == current_month or month_exists(month, registered)
    ]
    converter = WalletCurrencyConverter(db, user_id, user_default_currency(db, user_id))

    items = []
    for month in ordered_months:
        start, end = month_bounds(month)
        total_income = sum_amount(db, user_id, "income", start, end, converter)
        total_expense = sum_amount(db, user_id, "expense", start, end, converter)
        items.append(
            MonthlyComparisonItemResource(
                month=month,
                total_income=total_income,
                total_expense=total_expense,
                net=total_income - total_expense,
            )
        )
    return items
