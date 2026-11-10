"""Gasto por categoría de un mes frente a otro tramo equivalente (mes pasado, año pasado o promedio)."""

import uuid
from collections import defaultdict
from datetime import date
from decimal import Decimal

from sqlalchemy.orm import Session

from app.modules.analytics.contracts.enums import CompareAgainst
from app.modules.analytics.contracts.resources import CategoryComparisonItemResource, PeriodComparisonResource
from app.modules.analytics.services.period_totals import (
    WalletCurrencyConverter,
    registration_day,
    transactions_in_range,
    user_default_currency,
    window_exists,
)
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

    # Solo se compara contra períodos que existen desde que el usuario se registró: un mes
    # que terminó antes de su registro no tiene datos reales, comparar contra él es ruido.
    registered = registration_day(db, user_id)

    previous: dict[str, Decimal] = {}
    if against == "average":
        summed: dict[str, Decimal] = defaultdict(lambda: Decimal("0"))
        months_used = 0
        for offset in range(1, _AVERAGE_MONTHS + 1):
            past_window = shifted_window(window, resolved_month, -offset)
            if not window_exists(past_window[1], registered):
                continue
            months_used += 1
            for category, total in _category_totals(db, user_id, past_window, converter).items():
                summed[category] += total
        if months_used:
            previous = {category: total / months_used for category, total in summed.items()}
    else:
        delta = -12 if against == "year_ago" else -1
        past_window = shifted_window(window, resolved_month, delta)
        if window_exists(past_window[1], registered):
            previous = _category_totals(db, user_id, past_window, converter)

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
