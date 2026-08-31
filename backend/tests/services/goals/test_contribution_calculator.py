from datetime import date
from decimal import Decimal

from app.services.goals.contribution_calculator import compute_monthly_contribution


def test_splits_remaining_amount_across_calendar_months():
    # hoy 28-ago, target 30-nov -> 3 meses de diferencia de calendario.
    result = compute_monthly_contribution(
        target_amount=Decimal("240"), total_saved=Decimal("0"), target_date=date(2026, 11, 30), today=date(2026, 8, 28)
    )
    assert result == Decimal("80.00")


def test_only_counts_what_is_left_to_save():
    result = compute_monthly_contribution(
        target_amount=Decimal("300"), total_saved=Decimal("100"), target_date=date(2026, 12, 1), today=date(2026, 8, 1)
    )
    assert result == Decimal("50.00")  # 200 restantes / 4 meses


def test_never_negative_when_already_fully_funded():
    result = compute_monthly_contribution(
        target_amount=Decimal("100"), total_saved=Decimal("150"), target_date=date(2026, 12, 1), today=date(2026, 8, 1)
    )
    assert result == Decimal("0.00")


def test_clamps_to_minimum_one_month_when_target_date_already_passed():
    result = compute_monthly_contribution(
        target_amount=Decimal("50"), total_saved=Decimal("0"), target_date=date(2026, 1, 1), today=date(2026, 8, 1)
    )
    assert result == Decimal("50.00")


def test_clamps_to_minimum_one_month_within_the_same_month():
    result = compute_monthly_contribution(
        target_amount=Decimal("90"), total_saved=Decimal("0"), target_date=date(2026, 8, 20), today=date(2026, 8, 1)
    )
    assert result == Decimal("90.00")
