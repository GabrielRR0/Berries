"""Rangos de fechas por día, semana (lunes a domingo) y mes (funciones puras)."""

from calendar import monthrange
from datetime import date, datetime, timedelta, timezone

from app.modules.analytics.contracts.enums import Granularity
from app.modules.analytics.errors import InvalidPeriodError
from app.modules.analytics.utils.months import parse_month, shift_month

MAX_BUCKETS = 400


def to_utc_date(value: datetime) -> date:
    """Fecha UTC de un instante; si viene sin zona (SQLite) se asume UTC."""
    if value.tzinfo is not None:
        value = value.astimezone(timezone.utc)
    return value.date()


def utc_today() -> date:
    return datetime.now(timezone.utc).date()


def bucket_start(day: date, granularity: Granularity) -> date:
    if granularity == "day":
        return day
    if granularity == "week":
        return day - timedelta(days=day.weekday())
    return day.replace(day=1)


def next_bucket(start: date, granularity: Granularity) -> date:
    if granularity == "day":
        return start + timedelta(days=1)
    if granularity == "week":
        return start + timedelta(days=7)
    if start.month == 12:
        return date(start.year + 1, 1, 1)
    return date(start.year, start.month + 1, 1)


def bucket_starts(date_from: date, date_to: date, granularity: Granularity) -> list[date]:
    """Inicio de cada período que toca el rango, sin dejar huecos."""
    if date_from > date_to:
        raise InvalidPeriodError("date_from no puede ser posterior a date_to")
    starts: list[date] = []
    cursor = bucket_start(date_from, granularity)
    while cursor <= date_to:
        starts.append(cursor)
        if len(starts) > MAX_BUCKETS:
            raise InvalidPeriodError(f"El rango tiene más de {MAX_BUCKETS} períodos; reduce el rango o sube la granularidad")
        cursor = next_bucket(cursor, granularity)
    return starts


def day_range_bounds(first_day: date, last_day: date) -> tuple[datetime, datetime]:
    """Rango [inicio, fin) en UTC que cubre desde `first_day` hasta `last_day` inclusive."""
    start = datetime(first_day.year, first_day.month, first_day.day, tzinfo=timezone.utc)
    end_day = last_day + timedelta(days=1)
    end = datetime(end_day.year, end_day.month, end_day.day, tzinfo=timezone.utc)
    return start, end


def month_dates(month: str) -> tuple[date, date]:
    """Primer y último día (inclusive) del mes 'YYYY-MM'."""
    year, month_num = parse_month(month)
    return date(year, month_num, 1), date(year, month_num, monthrange(year, month_num)[1])


def elapsed_window(month: str, today: date) -> tuple[date, date]:
    """Días del mes ya transcurridos: hasta hoy si es el mes en curso, completo si ya pasó."""
    first, last = month_dates(month)
    if today < first:
        return first, first
    return first, min(last, today)


def shifted_window(window: tuple[date, date], month: str, delta_months: int) -> tuple[date, date]:
    """Mismo tramo de días (1..N) en otro mes, recortado si ese mes es más corto."""
    length = (window[1] - window[0]).days + 1
    first, last = month_dates(shift_month(month, delta_months))
    return first, min(last, first + timedelta(days=length - 1))
