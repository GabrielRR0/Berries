"""Cuándo se gasta: gasto por día, promedio por día de la semana y peso del fin de semana."""

import uuid
from collections import defaultdict
from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy.orm import Session

from app.modules.analytics.contracts.resources import HeatCellResource, SpendingPatternsResource, WeekdayAverageResource
from app.modules.analytics.services.period_totals import WalletCurrencyConverter, transactions_in_range, user_default_currency
from app.modules.analytics.utils.periods import day_range_bounds, to_utc_date, utc_today

_MIN_WEEKS = 2
_MAX_WEEKS = 26
_SATURDAY = 5


def get_spending_patterns(
    db: Session, user_id: uuid.UUID, weeks: int = 8, today: date | None = None
) -> SpendingPatternsResource:
    """Gasto diario de las últimas `weeks` semanas (desde el lunes de la más antigua hasta
    hoy). El promedio por día de la semana divide entre cuántas veces ocurrió ese día en el
    rango, no entre las semanas, así la semana en curso no baja el promedio de los días que
    aún no pasan."""
    weeks = max(_MIN_WEEKS, min(weeks, _MAX_WEEKS))
    last_day = today or utc_today()
    first_day = last_day - timedelta(days=last_day.weekday()) - timedelta(weeks=weeks - 1)
    converter = WalletCurrencyConverter(db, user_id, user_default_currency(db, user_id))

    start, end = day_range_bounds(first_day, last_day)
    zero = Decimal("0")
    daily: dict[date, Decimal] = defaultdict(lambda: zero)
    for row in transactions_in_range(db, user_id, "expense", start, end):
        daily[to_utc_date(row.occurred_at)] += converter.amount_of(row)

    heat: list[HeatCellResource] = []
    weekday_totals = [zero] * 7
    weekday_days = [0] * 7
    cursor = first_day
    while cursor <= last_day:
        total = daily.get(cursor, zero)
        heat.append(HeatCellResource(day=cursor, total=total))
        weekday_totals[cursor.weekday()] += total
        weekday_days[cursor.weekday()] += 1
        cursor += timedelta(days=1)

    grand_total = sum(weekday_totals, zero)
    averages = [
        WeekdayAverageResource(weekday=index, average=weekday_totals[index] / weekday_days[index] if weekday_days[index] else zero)
        for index in range(7)
    ]
    weekend_total = weekday_totals[_SATURDAY] + weekday_totals[_SATURDAY + 1]
    busiest_day = max(heat, key=lambda cell: cell.total) if grand_total > 0 else None

    return SpendingPatternsResource(
        first_day=first_day,
        last_day=last_day,
        weeks=weeks,
        heat=heat,
        weekday_averages=averages,
        daily_average=grand_total / len(heat),
        weekend_share=float(weekend_total / grand_total) if grand_total > 0 else 0.0,
        busiest_weekday=max(averages, key=lambda item: item.average).weekday if grand_total > 0 else None,
        busiest_day=busiest_day,
    )
