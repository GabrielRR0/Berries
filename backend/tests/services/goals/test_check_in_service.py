import uuid
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

import pytest

from app.services.auth.auth_service import register_user
from app.services.goals.check_in_service import (
    abandon_goal,
    get_goals_needing_check_in,
    get_goals_needing_check_in_for_user,
    list_check_ins_for_goal,
    record_check_in,
    update_check_in,
)
from app.services.goals.errors import (
    GoalNotActiveError,
    GoalNotFoundError,
    GoalValidationError,
    InsufficientAvailableBalanceError,
)
from app.services.goals.goal_service import create_goal
from app.services.wallets.errors import CurrencyMismatchError, WalletNotFoundError
from app.services.wallets.wallet_service import create_wallet

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


# --- record_check_in con wallet_id (reserva blanda) -----------------------------------
# Pedido explicito del usuario: "para cuando quiero agregar un aporte poder enlazarlo
# de alguna billetera que tenga". Confirmado: nunca mueve plata real.


def test_record_check_in_with_wallet_does_not_touch_wallet_balance(db):
    user = register_user(db, "ana@example.com", "clave12345", "Ana")
    wallet = create_wallet(db, user.id, "Cash", "USD", Decimal("1000"))
    goal = create_goal(db, user.id, "TV", Decimal("240"), "USD", _FUTURE)

    check_in = record_check_in(db, goal.id, user.id, amount_saved=Decimal("50"), wallet_id=wallet.id)

    db.refresh(wallet)
    assert wallet.balance == Decimal("1000")
    assert check_in.wallet_id == wallet.id


def test_record_check_in_rejects_a_wallet_without_enough_available_balance(db):
    user = register_user(db, "ana@example.com", "clave12345", "Ana")
    wallet = create_wallet(db, user.id, "Cash", "USD", Decimal("30"))
    goal = create_goal(db, user.id, "TV", Decimal("240"), "USD", _FUTURE)

    with pytest.raises(InsufficientAvailableBalanceError):
        record_check_in(db, goal.id, user.id, amount_saved=Decimal("50"), wallet_id=wallet.id)


def test_record_check_in_rejects_a_wallet_in_a_different_currency(db):
    user = register_user(db, "ana@example.com", "clave12345", "Ana")
    wallet = create_wallet(db, user.id, "Cash", "EUR", Decimal("1000"))
    goal = create_goal(db, user.id, "TV", Decimal("240"), "USD", _FUTURE)

    with pytest.raises(CurrencyMismatchError):
        record_check_in(db, goal.id, user.id, amount_saved=Decimal("50"), wallet_id=wallet.id)


def test_record_check_in_second_contribution_from_same_wallet_counts_the_first_as_committed(db):
    """Dos aportes de la misma meta enlazados a la MISMA billetera - el segundo debe
    ver el disponible ya reducido por el primero, no el saldo total de la billetera."""
    user = register_user(db, "ana@example.com", "clave12345", "Ana")
    wallet = create_wallet(db, user.id, "Cash", "USD", Decimal("100"))
    goal = create_goal(db, user.id, "TV", Decimal("240"), "USD", _FUTURE)

    record_check_in(db, goal.id, user.id, amount_saved=Decimal("60"), wallet_id=wallet.id)

    with pytest.raises(InsufficientAvailableBalanceError):
        record_check_in(db, goal.id, user.id, amount_saved=Decimal("60"), wallet_id=wallet.id)


# --- update_check_in -------------------------------------------------------------------
# Pedido explicito del usuario: reenlazar despues un aporte que quedo como "ingreso
# futuro" ("ese futuro ya acaba de pasar... quiero ir a metas y en ese aporte
# editarlo y decir que los voy a usar de mi billetera").


def test_update_check_in_links_a_previously_unlinked_contribution(db):
    user = register_user(db, "ana@example.com", "clave12345", "Ana")
    wallet = create_wallet(db, user.id, "Cash", "USD", Decimal("1000"))
    goal = create_goal(db, user.id, "TV", Decimal("240"), "USD", _FUTURE)
    check_in = record_check_in(db, goal.id, user.id, amount_saved=Decimal("50"), note="venta de la laptop")

    updated = update_check_in(db, goal.id, check_in.id, user.id, wallet_id=wallet.id, note="ya llego, es esta billetera")

    assert updated.wallet_id == wallet.id
    assert updated.note == "ya llego, es esta billetera"
    db.refresh(wallet)
    assert wallet.balance == Decimal("1000")  # nunca mueve plata real


def test_update_check_in_never_touches_amount_saved_or_total_saved(db):
    user = register_user(db, "ana@example.com", "clave12345", "Ana")
    wallet = create_wallet(db, user.id, "Cash", "USD", Decimal("1000"))
    goal = create_goal(db, user.id, "TV", Decimal("240"), "USD", _FUTURE)
    check_in = record_check_in(db, goal.id, user.id, amount_saved=Decimal("50"))

    update_check_in(db, goal.id, check_in.id, user.id, wallet_id=wallet.id, note=None)

    db.refresh(goal)
    assert check_in.amount_saved == Decimal("50")
    assert goal.total_saved == Decimal("50")


def test_update_check_in_can_unlink_a_wallet_back_to_future_income(db):
    user = register_user(db, "ana@example.com", "clave12345", "Ana")
    wallet = create_wallet(db, user.id, "Cash", "USD", Decimal("1000"))
    goal = create_goal(db, user.id, "TV", Decimal("240"), "USD", _FUTURE)
    check_in = record_check_in(db, goal.id, user.id, amount_saved=Decimal("50"), wallet_id=wallet.id)

    updated = update_check_in(db, goal.id, check_in.id, user.id, wallet_id=None, note="en realidad todavia no llega")

    assert updated.wallet_id is None


def test_update_check_in_reconfirming_the_same_wallet_does_not_reject_itself(db):
    """exclude_check_in_id: re-enlazar la MISMA billetera en una edicion no debe
    rechazarse contra su propio monto ya comprometido."""
    user = register_user(db, "ana@example.com", "clave12345", "Ana")
    wallet = create_wallet(db, user.id, "Cash", "USD", Decimal("50"))
    goal = create_goal(db, user.id, "TV", Decimal("240"), "USD", _FUTURE)
    check_in = record_check_in(db, goal.id, user.id, amount_saved=Decimal("50"), wallet_id=wallet.id)

    updated = update_check_in(db, goal.id, check_in.id, user.id, wallet_id=wallet.id, note="confirmado")

    assert updated.wallet_id == wallet.id


def test_update_check_in_still_works_on_a_completed_goal(db):
    user = register_user(db, "ana@example.com", "clave12345", "Ana")
    wallet = create_wallet(db, user.id, "Cash", "USD", Decimal("1000"))
    goal = create_goal(db, user.id, "TV", Decimal("50"), "USD", _FUTURE)
    check_in = record_check_in(db, goal.id, user.id, amount_saved=Decimal("50"))
    db.refresh(goal)
    assert goal.status == "completed"

    updated = update_check_in(db, goal.id, check_in.id, user.id, wallet_id=wallet.id, note=None)

    assert updated.wallet_id == wallet.id


def test_update_check_in_rejects_a_wallet_without_enough_available_balance(db):
    user = register_user(db, "ana@example.com", "clave12345", "Ana")
    wallet = create_wallet(db, user.id, "Cash", "USD", Decimal("10"))
    goal = create_goal(db, user.id, "TV", Decimal("240"), "USD", _FUTURE)
    check_in = record_check_in(db, goal.id, user.id, amount_saved=Decimal("50"))

    with pytest.raises(InsufficientAvailableBalanceError):
        update_check_in(db, goal.id, check_in.id, user.id, wallet_id=wallet.id, note=None)


def test_update_check_in_rejects_an_unknown_check_in_id(db):
    user = register_user(db, "ana@example.com", "clave12345", "Ana")
    goal = create_goal(db, user.id, "TV", Decimal("240"), "USD", _FUTURE)

    with pytest.raises(GoalNotFoundError):
        update_check_in(db, goal.id, uuid.uuid4(), user.id, wallet_id=None, note=None)


def test_update_check_in_rejects_a_check_in_belonging_to_another_users_goal(db):
    owner = register_user(db, "ana@example.com", "clave12345", "Ana")
    other = register_user(db, "beto@example.com", "clave12345", "Beto")
    goal = create_goal(db, owner.id, "TV", Decimal("240"), "USD", _FUTURE)
    check_in = record_check_in(db, goal.id, owner.id, amount_saved=Decimal("50"))

    with pytest.raises(GoalNotFoundError):
        update_check_in(db, goal.id, check_in.id, other.id, wallet_id=None, note=None)


def test_update_check_in_rejects_a_wallet_belonging_to_another_user(db):
    owner = register_user(db, "ana@example.com", "clave12345", "Ana")
    other = register_user(db, "beto@example.com", "clave12345", "Beto")
    other_wallet = create_wallet(db, other.id, "Cash", "USD", Decimal("1000"))
    goal = create_goal(db, owner.id, "TV", Decimal("240"), "USD", _FUTURE)
    check_in = record_check_in(db, goal.id, owner.id, amount_saved=Decimal("50"))

    with pytest.raises(WalletNotFoundError):
        update_check_in(db, goal.id, check_in.id, owner.id, wallet_id=other_wallet.id, note=None)
