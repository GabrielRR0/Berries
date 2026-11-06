from datetime import date
from decimal import ROUND_HALF_UP, Decimal


def _months_between(today: date, target_date: date) -> int:
    """Diferencia de meses de CALENDARIO (Y*12+M), sin precision de dia - minimo 1.
    Ej.: hoy 28-ago, target 30-nov -> 3 (coincide con "de aqui a 3 meses, $80/mes"
    x3=240). Deliberadamente sin ajustar por dia del mes: la cadencia del check-in ya
    es mensual, no diaria."""
    months = (target_date.year - today.year) * 12 + (target_date.month - today.month)
    return max(months, 1)


def compute_monthly_contribution(
    target_amount: Decimal, total_saved: Decimal, target_date: date, today: date
) -> Decimal:
    """Cuanto falta reunir, repartido entre los meses que quedan. Nunca negativo - si
    ya se junto todo (o mas), el resultado es 0. Se recalcula en cada llamada (nunca se
    guarda en la base): target_date puede moverse (posponer) y "hoy" siempre avanza."""
    remaining = max(target_amount - total_saved, Decimal("0"))
    months_left = _months_between(today, target_date)
    return (remaining / months_left).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
