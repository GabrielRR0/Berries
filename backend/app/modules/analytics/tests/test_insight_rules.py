from decimal import Decimal

from app.modules.analytics.contracts.resources import CategoryComparisonItemResource
from app.modules.analytics.services.insight_rules import build_insights


def _category(name, current, previous):
    current, previous = Decimal(current), Decimal(previous)
    return CategoryComparisonItemResource(
        category=name,
        current=current,
        previous=previous,
        delta_percent=float((current - previous) / previous * 100) if previous > 0 else None,
    )


def _build(**overrides):
    base = dict(
        expense_so_far=Decimal("450"),
        elapsed_days=9,
        days_in_month=30,
        is_current_month=True,
        average_prior_expense=Decimal("1500"),
        prior_transactions=40,
        categories=[_category("Mercado", "300", "290"), _category("Transporte", "150", "160")],
        weekend_share=0.28,
        busiest_weekday=4,
        previous_net_savings=Decimal("100"),
    )
    base.update(overrides)
    return build_insights(**base)


def _codes(insights):
    return [item.code for item in insights]


def test_few_prior_transactions_only_warn_that_data_is_missing():
    insights = _build(prior_transactions=2, expense_so_far=Decimal("9999"))

    assert _codes(insights) == ["not_enough_history"]


def test_steady_spending_reports_on_track():
    assert _codes(_build()) == ["on_track"]


def test_projection_over_fifteen_percent_is_an_alert_and_comes_first():
    insights = _build(expense_so_far=Decimal("600"), weekend_share=0.5)

    assert insights[0].code == "projected_overspend"
    assert insights[0].level == "alert"
    assert insights[0].amount == Decimal("2000")
    assert "weekend_heavy" in _codes(insights)


def test_projection_between_ten_and_fifteen_percent_is_only_a_warning():
    insights = _build(expense_so_far=Decimal("500"))  # proyecta 1.667 contra 1.500: +11%

    assert insights[0].code == "projected_overspend"
    assert insights[0].level == "warning"


def test_projection_far_below_average_is_a_positive_info():
    insights = _build(expense_so_far=Decimal("300"))

    assert _codes(insights) == ["projected_underspend"]
    assert insights[0].level == "info"


def test_no_projection_in_the_first_days_or_for_closed_months():
    assert "projected_overspend" not in _codes(_build(expense_so_far=Decimal("900"), elapsed_days=2))
    assert "projected_overspend" not in _codes(_build(expense_so_far=Decimal("9000"), is_current_month=False))


def test_category_spike_needs_both_percentage_and_weight():
    big = _category("Restaurantes", "200", "100")
    tiny = _category("Otros", "6", "2")  # +200% pero pesa menos del 5% del gasto
    insights = _build(categories=[_category("Mercado", "300", "300"), big, tiny])

    spikes = [item for item in insights if item.code == "category_spike"]
    assert [item.category for item in spikes] == ["Restaurantes"]
    assert spikes[0].amount == Decimal("200")
    assert spikes[0].reference_amount == Decimal("100")


def test_category_without_previous_spending_is_not_a_spike():
    insights = _build(categories=[_category("Mercado", "300", "300"), _category("Nueva", "200", "0")])

    assert "category_spike" not in _codes(insights)


def test_negative_savings_last_month_is_flagged():
    insights = _build(previous_net_savings=Decimal("-170"))

    assert "negative_savings_last_month" in _codes(insights)


def test_best_category_drop_is_reported_as_good_news():
    insights = _build(categories=[_category("Mercado", "300", "300"), _category("Transporte", "100", "200")])

    drop = next(item for item in insights if item.code == "category_drop")
    assert drop.category == "Transporte"
    assert drop.level == "info"


def test_insights_are_sorted_by_severity_and_capped():
    insights = _build(
        expense_so_far=Decimal("600"),
        weekend_share=0.6,
        previous_net_savings=Decimal("-5"),
        categories=[
            _category("A", "300", "100"),
            _category("B", "300", "100"),
            _category("C", "300", "100"),
            _category("D", "50", "300"),
        ],
    )

    levels = [item.level for item in insights]
    assert levels == sorted(levels, key=["alert", "warning", "info"].index)
    assert len(insights) <= 6
