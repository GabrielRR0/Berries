import uuid
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

import pytest

from app.services.goals.check_in_service import (
    abandon_goal,
    get_goals_needing_check_in,
    get_goals_needing_check_in_for_user,
    list_check_ins_for_goal,
    record_check_in,
)
from app.services.goals.errors import GoalNotActiveError, GoalValidationError
from app.services.goals.goal_service import create_goal

_FUTURE = date.today() + timedelta(days=180)


def _created_last_month(goal, db):
    """Fuerza created_at a un mes atras para que la meta ya sea elegible para
    check-in (get_goals_needing_check_in excluye el mes de alta a proposito)."""
    goal.created_at = datetime.now(timezone.utc) - timedelta(days=35)
    db.commit()
    db.refresh(goal)
    return goal


def test_record_check_in_accumulates_total_saved(db):
    user_id = uuid.uuid4()
    goal = create_goal(db, user_id, "TV", Decimal("240"), "USD", _FUTURE)

    record_check_in(db, goal.id, user_id, amount_saved=Decimal("80"))
    db.refresh(goal)

    assert goal.total_saved == Decimal("80")
    assert goal.status == "active"


def test_record_check_in_completes_goal_when_target_reached(db):
    user_id = uuid.uuid4()
    goal = create_goal(db, user_id, "TV", Decimal("240"), "USD", _FUTURE)

    record_check_in(db, goal.id, user_id, amount_saved=Decimal("240"))
    db.refresh(goal)

    assert goal.status == "completed"
    assert goal.completed_at is not None


def test_record_check_in_completes_goal_when_overfunded_early(db):
    user_id = uuid.uuid4()
    goal = create_goal(db, user_id, "TV", Decimal("240"), "USD", _FUTURE)

    record_check_in(db, goal.id, user_id, amount_saved=Decimal("300"))
    db.refresh(goal)

    assert goal.status == "completed"
    assert goal.total_saved == Decimal("300")


def test_record_check_in_with_new_target_date_postpones_and_tracks_it(db):
    user_id = uuid.uuid4()
    goal = create_goal(db, user_id, "TV", Decimal("240"), "USD", _FUTURE)
    new_date = _FUTURE + timedelta(days=30)

    check_in = record_check_in(db, goal.id, user_id, amount_saved=Decimal("0"), new_target_date=new_date, note="mes dificil")
    db.refresh(goal)

    assert goal.target_date == new_date
    assert check_in.previous_target_date == _FUTURE
    assert check_in.new_target_date == new_date
    assert check_in.note == "mes dificil"


def test_record_check_in_rejects_postponing_to_an_earlier_date(db):
    user_id = uuid.uuid4()
    goal = create_goal(db, user_id, "TV", Decimal("240"), "USD", _FUTURE)

    with pytest.raises(GoalValidationError):
        record_check_in(db, goal.id, user_id, amount_saved=Decimal("0"), new_target_date=_FUTURE - timedelta(days=1))


def test_record_check_in_rejects_non_active_goal(db):
    user_id = uuid.uuid4()
    goal = create_goal(db, user_id, "TV", Decimal("240"), "USD", _FUTURE)
    abandon_goal(db, goal.id, user_id)

    with pytest.raises(GoalNotActiveError):
        record_check_in(db, goal.id, user_id, amount_saved=Decimal("10"))


def test_multiple_check_ins_same_month_are_allowed_and_both_accumulate(db):
    """Sin restriccion UNIQUE en (goal_id, period_month) a proposito - un aporte ad-hoc
    ademas del check-in mensual no deberia fallar."""
    user_id = uuid.uuid4()
    goal = create_goal(db, user_id, "TV", Decimal("240"), "USD", _FUTURE)

    record_check_in(db, goal.id, user_id, amount_saved=Decimal("40"))
    record_check_in(db, goal.id, user_id, amount_saved=Decimal("40"))
    db.refresh(goal)

    assert goal.total_saved == Decimal("80")
    assert len(list_check_ins_for_goal(db, goal.id, user_id)) == 2


def test_abandon_goal_sets_status_and_rejects_double_abandon(db):
    user_id = uuid.uuid4()
    goal = create_goal(db, user_id, "TV", Decimal("240"), "USD", _FUTURE)

    abandoned = abandon_goal(db, goal.id, user_id)
    assert abandoned.status == "abandoned"

    with pytest.raises(GoalNotActiveError):
        abandon_goal(db, goal.id, user_id)


def test_get_goals_needing_check_in_excludes_goal_created_this_month(db):
    user_id = uuid.uuid4()
    create_goal(db, user_id, "TV", Decimal("240"), "USD", _FUTURE)  # created_at = ahora

    pending = get_goals_needing_check_in(db, date.today())

    assert pending == []


def test_get_goals_needing_check_in_includes_goal_from_a_prior_month_without_check_in(db):
    user_id = uuid.uuid4()
    goal = create_goal(db, user_id, "TV", Decimal("240"), "USD", _FUTURE)
    _created_last_month(goal, db)

    pending = get_goals_needing_check_in(db, date.today())

    assert [g.id for g in pending] == [goal.id]


def test_get_goals_needing_check_in_excludes_goal_already_checked_in_this_month(db):
    user_id = uuid.uuid4()
    goal = create_goal(db, user_id, "TV", Decimal("240"), "USD", _FUTURE)
    _created_last_month(goal, db)
    record_check_in(db, goal.id, user_id, amount_saved=Decimal("80"))

    pending = get_goals_needing_check_in(db, date.today())

    assert pending == []


def test_get_goals_needing_check_in_excludes_inactive_goals(db):
    user_id = uuid.uuid4()
    goal = create_goal(db, user_id, "TV", Decimal("240"), "USD", _FUTURE)
    _created_last_month(goal, db)
    abandon_goal(db, goal.id, user_id)

    pending = get_goals_needing_check_in(db, date.today())

    assert pending == []


def test_get_goals_needing_check_in_for_user_filters_by_owner(db):
    user_id = uuid.uuid4()
    other_user_id = uuid.uuid4()
    mine = create_goal(db, user_id, "TV", Decimal("240"), "USD", _FUTURE)
    _created_last_month(mine, db)
    theirs = create_goal(db, other_user_id, "Moto", Decimal("2000"), "USD", _FUTURE)
    _created_last_month(theirs, db)

    pending = get_goals_needing_check_in_for_user(db, user_id, date.today())

    assert [g.id for g in pending] == [mine.id]
