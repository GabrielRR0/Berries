"""Reglas de las recomendaciones: funciones puras, sin base de datos, fáciles de probar."""

from decimal import Decimal

from app.modules.analytics.contracts.resources import CategoryComparisonItemResource, InsightResource

MIN_HISTORY_TRANSACTIONS = 5
MIN_DAYS_FOR_PROJECTION = 3
PROJECTION_WARNING_PERCENT = 10.0
PROJECTION_ALERT_PERCENT = 15.0
CATEGORY_SPIKE_PERCENT = 30.0
CATEGORY_DROP_PERCENT = -10.0
# Una categoría solo cuenta como "subió/bajó mucho" si el cambio pesa al menos esto del gasto total.
MIN_CHANGE_SHARE = Decimal("0.05")
WEEKEND_HEAVY_SHARE = 0.4
MAX_SPIKES = 2
MAX_INSIGHTS = 6

_LEVEL_RANK = {"alert": 0, "warning": 1, "info": 2}


def build_insights(
    *,
    expense_so_far: Decimal,
    elapsed_days: int,
    days_in_month: int,
    is_current_month: bool,
    average_prior_expense: Decimal,
    prior_transactions: int,
    categories: list[CategoryComparisonItemResource],
    weekend_share: float,
    busiest_weekday: int | None,
    previous_net_savings: Decimal,
) -> list[InsightResource]:
    """Recomendaciones ordenadas de más a menos urgentes. Con poco historial devuelve solo
    el aviso de que faltan datos, para no opinar sobre promedios que todavía no existen."""
    if prior_transactions < MIN_HISTORY_TRANSACTIONS:
        return [InsightResource(code="not_enough_history", level="info")]

    found: list[InsightResource] = []

    if is_current_month and elapsed_days >= MIN_DAYS_FOR_PROJECTION and average_prior_expense > 0:
        projected = expense_so_far / elapsed_days * days_in_month
        diff = float((projected - average_prior_expense) / average_prior_expense * 100)
        if diff >= PROJECTION_WARNING_PERCENT:
            found.append(
                InsightResource(
                    code="projected_overspend",
                    level="alert" if diff >= PROJECTION_ALERT_PERCENT else "warning",
                    amount=projected,
                    reference_amount=average_prior_expense,
                    percent=diff,
                )
            )
        elif diff <= -PROJECTION_WARNING_PERCENT:
            found.append(
                InsightResource(
                    code="projected_underspend",
                    level="info",
                    amount=projected,
                    reference_amount=average_prior_expense,
                    percent=diff,
                )
            )

    total_current = sum((item.current for item in categories), Decimal("0"))
    floor = total_current * MIN_CHANGE_SHARE

    spikes = [
        item
        for item in categories
        if item.delta_percent is not None
        and item.delta_percent >= CATEGORY_SPIKE_PERCENT
        and item.current - item.previous >= floor
    ]
    spikes.sort(key=lambda item: item.current - item.previous, reverse=True)
    for item in spikes[:MAX_SPIKES]:
        found.append(
            InsightResource(
                code="category_spike",
                level="warning",
                category=item.category,
                amount=item.current,
                reference_amount=item.previous,
                percent=item.delta_percent,
            )
        )

    if weekend_share >= WEEKEND_HEAVY_SHARE:
        found.append(
            InsightResource(
                code="weekend_heavy", level="warning", percent=weekend_share * 100, weekday=busiest_weekday
            )
        )

    if previous_net_savings < 0:
        found.append(InsightResource(code="negative_savings_last_month", level="warning", amount=previous_net_savings))

    drops = [
        item
        for item in categories
        if item.delta_percent is not None
        and item.delta_percent <= CATEGORY_DROP_PERCENT
        and item.previous - item.current >= floor
    ]
    drops.sort(key=lambda item: item.previous - item.current, reverse=True)
    if drops:
        best = drops[0]
        found.append(
            InsightResource(
                code="category_drop",
                level="info",
                category=best.category,
                amount=best.current,
                reference_amount=best.previous,
                percent=best.delta_percent,
            )
        )

    if not found:
        found.append(InsightResource(code="on_track", level="info"))

    found.sort(key=lambda item: _LEVEL_RANK[item.level])
    return found[:MAX_INSIGHTS]
