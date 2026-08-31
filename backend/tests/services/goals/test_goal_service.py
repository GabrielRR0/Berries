import uuid
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

import pytest

from app.services.auth.auth_service import register_user
from app.services.goals.errors import GoalNotActiveError, GoalNotFoundError, GoalValidationError
from app.services.goals.goal_service import (
    build_goal_response,
    create_goal,
    delete_goal,
    get_goal_owned_by_user,
    get_goal_summary,
    get_savings_capacity,
    list_goals_for_user,
    update_goal,
)
from app.services.transactions.transaction_service import create_transaction
from app.services.wallets.wallet_service import create_wallet

_FUTURE = date.today() + timedelta(days=90)
_LATER = date.today() + timedelta(days=180)


def test_create_goal_rejects_non_positive_amount(db):
    with pytest.raises(GoalValidationError):
        create_goal(db, uuid.uuid4(), "TV", Decimal("0"), "USD", _FUTURE)


def test_create_goal_rejects_past_target_date(db):
    with pytest.raises(GoalValidationError):
        create_goal(db, uuid.uuid4(), "TV", Decimal("240"), "USD", date.today() - timedelta(days=1))


def test_create_goal_starts_active_with_zero_saved(db):
    goal = create_goal(db, uuid.uuid4(), "TV", Decimal("240"), "USD", _FUTURE)

    assert goal.status == "active"
    assert goal.total_saved == Decimal("0")
    assert goal.title == "TV"


def test_create_goal_defaults_to_custom_type(db):
    goal = create_goal(db, uuid.uuid4(), "TV", Decimal("240"), "USD", _FUTURE)

    assert goal.goal_type == "custom"


def test_create_goal_accepts_a_template_type(db):
    goal = create_goal(db, uuid.uuid4(), "MacBook", Decimal("1200"), "USD", _FUTURE, goal_type="computer")

    assert goal.goal_type == "computer"


def test_build_goal_response_includes_goal_type(db):
    goal = create_goal(db, uuid.uuid4(), "MacBook", Decimal("1200"), "USD", _FUTURE, goal_type="computer")

    response = build_goal_response(goal, today=date.today())

    assert response.goal_type == "computer"


def test_get_goal_owned_by_user_raises_for_other_users_goal(db):
    owner_id = uuid.uuid4()
    other_id = uuid.uuid4()
    goal = create_goal(db, owner_id, "TV", Decimal("240"), "USD", _FUTURE)

    with pytest.raises(GoalNotFoundError):
        get_goal_owned_by_user(db, goal.id, other_id)


def test_delete_goal_removes_it(db):
    user_id = uuid.uuid4()
    goal = create_goal(db, user_id, "TV", Decimal("240"), "USD", _FUTURE)

    delete_goal(db, goal.id, user_id)

    assert list_goals_for_user(db, user_id) == []


def test_list_goals_for_user_filters_by_status(db):
    user_id = uuid.uuid4()
    create_goal(db, user_id, "TV", Decimal("240"), "USD", _FUTURE)
    other = create_goal(db, user_id, "MacBook", Decimal("1200"), "USD", _FUTURE)
    other.status = "completed"
    db.commit()

    active = list_goals_for_user(db, user_id, status="active")
    completed = list_goals_for_user(db, user_id, status="completed")

    assert len(active) == 1
    assert active[0].title == "TV"
    assert len(completed) == 1
    assert completed[0].title == "MacBook"


def test_get_goal_summary_only_counts_active_goals(db):
    user_id = uuid.uuid4()
    create_goal(db, user_id, "TV", Decimal("240"), "USD", _FUTURE)
    abandoned = create_goal(db, user_id, "Moto", Decimal("2000"), "USD", _FUTURE)
    abandoned.status = "abandoned"
    db.commit()

    summary = get_goal_summary(db, user_id)

    assert summary["total_target"] == Decimal("240")
    assert summary["total_saved"] == Decimal("0")


def test_build_goal_response_includes_suggested_contribution_and_no_postponement_flag(db):
    goal = create_goal(db, uuid.uuid4(), "TV", Decimal("240"), "USD", date.today() + timedelta(days=89))

    response = build_goal_response(goal, today=date.today())

    assert response.suggested_monthly_contribution > Decimal("0")
    assert response.last_check_in_postponed is False


# --- update_goal ---------------------------------------------------------------------


def test_update_goal_overwrites_title_amount_currency_and_date(db):
    user_id = uuid.uuid4()
    goal = create_goal(db, user_id, "TV", Decimal("240"), "USD", _FUTURE)

    updated = update_goal(db, goal.id, user_id, "MacBook", Decimal("1200"), "EUR", _LATER)

    assert updated.title == "MacBook"
    assert updated.target_amount == Decimal("1200")
    assert updated.currency == "EUR"
    assert updated.target_date == _LATER


def test_update_goal_does_not_create_any_check_in_row(db):
    user_id = uuid.uuid4()
    goal = create_goal(db, user_id, "TV", Decimal("240"), "USD", _FUTURE)

    update_goal(db, goal.id, user_id, "TV", Decimal("300"), "USD", _LATER)

    assert goal.check_ins == []


def test_update_goal_rejects_non_positive_amount(db):
    user_id = uuid.uuid4()
    goal = create_goal(db, user_id, "TV", Decimal("240"), "USD", _FUTURE)

    with pytest.raises(GoalValidationError):
        update_goal(db, goal.id, user_id, "TV", Decimal("0"), "USD", _FUTURE)


def test_update_goal_rejects_past_target_date(db):
    user_id = uuid.uuid4()
    goal = create_goal(db, user_id, "TV", Decimal("240"), "USD", _FUTURE)

    with pytest.raises(GoalValidationError):
        update_goal(db, goal.id, user_id, "TV", Decimal("240"), "USD", date.today() - timedelta(days=1))


def test_update_goal_rejects_editing_a_non_active_goal(db):
    user_id = uuid.uuid4()
    goal = create_goal(db, user_id, "TV", Decimal("240"), "USD", _FUTURE)
    goal.status = "abandoned"
    db.commit()

    with pytest.raises(GoalNotActiveError):
        update_goal(db, goal.id, user_id, "TV", Decimal("240"), "USD", _LATER)


def test_update_goal_auto_completes_when_new_amount_is_already_covered_by_savings(db):
    user_id = uuid.uuid4()
    goal = create_goal(db, user_id, "TV", Decimal("240"), "USD", _FUTURE)
    goal.total_saved = Decimal("200")
    db.commit()

    updated = update_goal(db, goal.id, user_id, "TV", Decimal("150"), "USD", _LATER)

    assert updated.status == "completed"
    assert updated.completed_at is not None


# --- get_savings_capacity -------------------------------------------------------------


def test_get_savings_capacity_is_all_zero_with_no_transactions(db):
    user = register_user(db, "ana@example.com", "clave12345", "Ana")

    capacity = get_savings_capacity(db, user.id)

    assert capacity["avg_monthly_income"] == Decimal("0")
    assert capacity["avg_monthly_expense"] == Decimal("0")
    assert capacity["avg_monthly_available"] == Decimal("0")


def test_get_savings_capacity_averages_income_and_expense_over_the_window(db):
    user = register_user(db, "ana@example.com", "clave12345", "Ana")
    wallet = create_wallet(db, user.id, "Cash", "USD")
    now = datetime.now(timezone.utc)
    create_transaction(db, user.id, wallet.id, "income", Decimal("900.00"), "Salario", occurred_at=now)
    create_transaction(db, user.id, wallet.id, "expense", Decimal("300.00"), "Comida", occurred_at=now)

    capacity = get_savings_capacity(db, user.id, months=3)

    # Solo el mes actual tiene movimientos; los otros 2 del promedio quedan en cero.
    assert capacity["avg_monthly_income"] == Decimal("300.00")
    assert capacity["avg_monthly_expense"] == Decimal("100.00")
    assert capacity["avg_monthly_available"] == Decimal("200.00")
