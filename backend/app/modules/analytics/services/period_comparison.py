"""Gasto por categoría de un mes frente a otro tramo equivalente (mes pasado, año pasado o promedio)."""

import uuid
from collections import defaultdict
from datetime import date
from decimal import Decimal

from sqlalchemy.orm import Session

from app.modules.analytics.contracts.enums import CompareAgainst
from app.modules.analytics.contracts.resources import CategoryComparisonItemResource, PeriodComparisonResource
from app.modules.analytics.services.period_totals import WalletCurrencyConverter, transactions_in_range, user_default_currency
from app.modules.analytics.utils.months import resolve_month
from app.modules.analytics.utils.periods import day_range_bounds, elapsed_window, month_dates, shifted_window, utc_today

_AVERAGE_MONTHS = 3


def _percent_change(current: Decimal, previous: Decimal) -> float | None:
    if previous <= 0:
        return None
    return float((current - previous) / previous * 100)


def _category_totals(
    db: Session, user_id: uuid.UUID, window: tuple[date, date], converter: WalletCurrencyConverter
) -> dict[str, Decimal]:
    start, end = day_range_bounds(*window)
    totals: dict[str, Decimal] = defaultdict(lambda: Decimal("0"))
    for row in transactions_in_range(db, user_id, "expense", start, end):
        totals[row.category] += converter.amount_of(row)
    return totals


def get_period_comparison(
    db: Session,
    user_id: uuid.UUID,
    month: str | None = None,
    against: CompareAgainst = "previous",
    today: date | None = None,
) -> PeriodComparisonResource:
    """Compara los días 1..N del mes (N = días transcurridos si es el mes en curso) con
    los mismos días de otro período, para no comparar un mes a medias contra uno entero.
    `average` promedia los 3 meses anteriores."""
    resolved_month = resolve_month(month)
    window = elapsed_window(resolved_month, today or utc_today())
    converter = WalletCurrencyConverter(db, user_id, user_default_currency(db, user_id))

    current = _category_totals(db, user_id, window, converter)

    if against == "average":
        summed: dict[str, Decimal] = defaultdict(lambda: Decimal("0"))
        for offset in range(1, _AVERAGE_MONTHS + 1):
            for category, total in _category_totals(
                db, user_id, shifted_window(window, resolved_month, -offset), converter
            ).items():
                summed[category] += total
        previous = {category: total / _AVERAGE_MONTHS for category, total in summed.items()}
    else:
        delta = -12 if against == "year_ago" else -1
        previous = _category_totals(db, user_id, shifted_window(window, resolved_month, delta), converter)

    zero = Decimal("0")
    items = [
        CategoryComparisonItemResource(
            category=category,
            current=current.get(category, zero),
            previous=previous.get(category, zero),
            delta_percent=_percent_change(current.get(category, zero), previous.get(category, zero)),
        )
        for category in set(current) | set(previous)
    ]
    items.sort(key=lambda item: (item.current, item.previous), reverse=True)

    current_total = sum((item.current for item in items), zero)
    previous_total = sum((item.previous for item in items), zero)
    first_day, last_day = month_dates(resolved_month)
    return PeriodComparisonResource(
        period=resolved_month,
        against=against,
        window_start=window[0],
        window_end=window[1],
        elapsed_days=(window[1] - window[0]).days + 1,
        days_in_month=(last_day - first_day).days + 1,
        current_total=current_total,
        previous_total=previous_total,
        delta_percent=_percent_change(current_total, previous_total),
        categories=items,
    )
