"""Recomendaciones sobre el gasto del mes, calculadas contra el historial del propio usuario."""

import uuid
from datetime import date
from decimal import Decimal

from sqlalchemy.orm import Session

from app.modules.analytics.contracts.resources import InsightResource
from app.modules.analytics.services.insight_rules import build_insights
from app.modules.analytics.services.period_comparison import get_period_comparison
from app.modules.analytics.services.period_totals import (
    WalletCurrencyConverter,
    net_savings_for_month,
    transactions_in_range,
    user_default_currency,
)
from app.modules.analytics.services.spending_patterns import get_spending_patterns
from app.modules.analytics.utils.months import month_bounds, resolve_month, shift_month
from app.modules.analytics.utils.periods import month_dates, utc_today

_PRIOR_MONTHS = 3


def get_insights(
    db: Session, user_id: uuid.UUID, month: str | None = None, today: date | None = None
) -> list[InsightResource]:
    """Junta los datos del mes (comparativa con el mes pasado, patrón semanal, promedio de los
    3 meses anteriores) y los pasa por las reglas de `insight_rules`."""
    resolved_month = resolve_month(month)
    today = today or utc_today()
    converter = WalletCurrencyConverter(db, user_id, user_default_currency(db, user_id))

    comparison = get_period_comparison(db, user_id, resolved_month, "previous", today)
    patterns = get_spending_patterns(db, user_id, 8, today)

    prior_total = Decimal("0")
    prior_transactions = 0
    for offset in range(1, _PRIOR_MONTHS + 1):
        start, end = month_bounds(shift_month(resolved_month, -offset))
        rows = transactions_in_range(db, user_id, "expense", start, end)
        prior_transactions += len(rows)
        prior_total += sum((converter.amount_of(row) for row in rows), Decimal("0"))

    first_day, last_day = month_dates(resolved_month)
    return build_insights(
        expense_so_far=comparison.current_total,
        elapsed_days=comparison.elapsed_days,
        days_in_month=comparison.days_in_month,
        is_current_month=first_day <= today <= last_day,
        average_prior_expense=prior_total / _PRIOR_MONTHS,
        prior_transactions=prior_transactions,
        categories=comparison.categories,
        weekend_share=patterns.weekend_share,
        busiest_weekday=patterns.busiest_weekday,
        previous_net_savings=net_savings_for_month(db, user_id, shift_month(resolved_month, -1), converter),
    )
