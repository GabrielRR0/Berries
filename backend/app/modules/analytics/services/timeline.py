"""Ingresos y gastos por día, semana o mes dentro de un rango de fechas."""

import uuid
from datetime import date
from decimal import Decimal

from sqlalchemy.orm import Session

from app.modules.analytics.contracts.enums import Granularity
from app.modules.analytics.contracts.resources import TimelineBucketResource, TimelineResource
from app.modules.analytics.services.period_totals import WalletCurrencyConverter, transactions_in_range, user_default_currency
from app.modules.analytics.utils.periods import bucket_start, bucket_starts, day_range_bounds, to_utc_date


def get_timeline(
    db: Session,
    user_id: uuid.UUID,
    granularity: Granularity,
    date_from: date,
    date_to: date,
    wallet_id: uuid.UUID | None = None,
) -> TimelineResource:
    """Una entrada por período entre `date_from` y `date_to` (inclusive), aunque no haya
    movimientos (totales en cero). El primer período se mide completo: si `date_from`
    cae a mitad de semana, la semana arranca igual en su lunes. Las dos consultas (ingresos
    y gastos) cubren todo el rango de una vez; el agrupado se hace en Python porque los
    montos están cifrados."""
    starts = bucket_starts(date_from, date_to, granularity)
    range_start, range_end = day_range_bounds(starts[0], date_to)
    converter = WalletCurrencyConverter(db, user_id, user_default_currency(db, user_id))

    income = {start: Decimal("0") for start in starts}
    expense = {start: Decimal("0") for start in starts}
    counts = {start: 0 for start in starts}

    for kind, totals in (("income", income), ("expense", expense)):
        for row in transactions_in_range(db, user_id, kind, range_start, range_end):
            if wallet_id is not None and row.wallet_id != wallet_id:
                continue
            key = bucket_start(to_utc_date(row.occurred_at), granularity)
            if key not in totals:
                continue
            totals[key] += converter.amount_of(row)
            counts[key] += 1

    return TimelineResource(
        granularity=granularity,
        buckets=[
            TimelineBucketResource(
                start=start,
                total_income=income[start],
                total_expense=expense[start],
                net=income[start] - expense[start],
                count=counts[start],
            )
            for start in starts
        ],
    )
