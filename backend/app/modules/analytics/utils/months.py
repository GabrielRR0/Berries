"""Manejo de meses 'YYYY-MM' (funciones puras)."""

import re
from datetime import datetime, timezone

from app.modules.analytics.errors import InvalidPeriodError


MONTH_PATTERN = re.compile(r"^\d{4}-(0[1-9]|1[0-2])$")


def resolve_month(month: str | None) -> str:
    """Devuelve `month` validado, o el mes calendario actual (UTC) si no se pasó uno."""
    if month is None:
        now = datetime.now(timezone.utc)
        return f"{now.year:04d}-{now.month:02d}"
    if not MONTH_PATTERN.match(month):
        raise InvalidPeriodError(f"Formato de mes inválido: {month!r} (esperado 'YYYY-MM')")
    return month


def parse_month(month: str) -> tuple[int, int]:
    year_str, month_str = month.split("-")
    return int(year_str), int(month_str)


def month_bounds(month: str) -> tuple[datetime, datetime]:
    """Rango [inicio, fin) en UTC que cubre el mes calendario 'YYYY-MM' dado."""
    year, month_num = parse_month(month)
    start = datetime(year, month_num, 1, tzinfo=timezone.utc)
    if month_num == 12:
        end = datetime(year + 1, 1, 1, tzinfo=timezone.utc)
    else:
        end = datetime(year, month_num + 1, 1, tzinfo=timezone.utc)
    return start, end


def shift_month(month: str, delta: int) -> str:
    """Desplaza 'YYYY-MM' por `delta` meses (negativo = hacia atrás en el tiempo)."""
    year, month_num = parse_month(month)
    total = year * 12 + (month_num - 1) + delta
    new_year, zero_based_month = divmod(total, 12)
    return f"{new_year:04d}-{zero_based_month + 1:02d}"
