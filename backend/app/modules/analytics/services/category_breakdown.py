"""Gastos o ingresos por categoría: del mes y su evolución mes a mes."""

import uuid
from collections import defaultdict
from decimal import Decimal

from sqlalchemy.orm import Session

from app.modules.analytics.contracts.resources import CategoryBreakdownItemResource, CategoryMonthlyTrendItemResource, CategoryMonthlyTrendResource
from app.modules.analytics.services.period_totals import (
    WalletCurrencyConverter,
    month_exists,
    registration_day,
    transactions_in_range,
    user_default_currency,
)
from app.modules.analytics.utils.months import month_bounds, resolve_month, shift_month


_OTHER_CATEGORY_LABEL = "Otros"


def get_category_breakdown(
    db: Session, user_id: uuid.UUID, kind: str, month: str | None = None
) -> list[CategoryBreakdownItemResource]:
    """Desglose por categoría de un `kind` ("income"/"expense") en el mes dado (o el
    actual), ordenado descendente por total. `percentage` es la participación de cada
    categoría sobre el total de ese type+month; 0.0 para todas si ese total es 0 (nunca
    división por cero)."""
    resolved_month = resolve_month(month)
    start, end = month_bounds(resolved_month)
    converter = WalletCurrencyConverter(db, user_id, user_default_currency(db, user_id))

    rows = transactions_in_range(db, user_id, kind, start, end)

    totals_by_category: dict[str, Decimal] = defaultdict(lambda: Decimal("0"))
    for row in rows:
        totals_by_category[row.category] += converter.amount_of(row)

    totals = list(totals_by_category.items())
    grand_total = sum((total for _, total in totals), Decimal("0"))

    items = [
        CategoryBreakdownItemResource(
            category=category,
            total=total,
            percentage=float(total / grand_total * 100) if grand_total > 0 else 0.0,
        )
        for category, total in totals
    ]
    items.sort(key=lambda item: item.total, reverse=True)
    return items


def get_category_monthly_trend(
    db: Session, user_id: uuid.UUID, kind: str, months: int = 6, top_n: int = 5
) -> CategoryMonthlyTrendResource:
    """Cuánto se movió cada categoría mes a mes en la ventana pedida (ej. "cuánto gasté
    en Mercado cada uno de los últimos 6 meses") — a diferencia de get_category_breakdown
    (un solo mes, forma de torta), acá se repite la misma agrupación por categoría una
    vez por cada mes de la ventana. Solo se devuelven las `top_n` categorías con mayor
    total ACUMULADO en toda la ventana, una por una; el resto se junta en una única
    entrada "Otros" para que la lista se mantenga legible (un usuario con 20+
    categorías no debería ver 20+ filas de sparkline)."""
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

    totals_by_month: list[dict[str, Decimal]] = []
    grand_totals: dict[str, Decimal] = defaultdict(lambda: Decimal("0"))

    for month in ordered_months:
        start, end = month_bounds(month)
        rows = transactions_in_range(db, user_id, kind, start, end)
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
        CategoryMonthlyTrendItemResource(
            category=category,
            monthly_totals=[month_totals.get(category, Decimal("0")) for month_totals in totals_by_month],
        )
        for category in top_categories
    ]

    if other_categories:
        items.append(
            CategoryMonthlyTrendItemResource(
                category=_OTHER_CATEGORY_LABEL,
                monthly_totals=[
                    sum((month_totals.get(category, Decimal("0")) for category in other_categories), Decimal("0"))
                    for month_totals in totals_by_month
                ],
            )
        )

    return CategoryMonthlyTrendResource(months=ordered_months, categories=items)
