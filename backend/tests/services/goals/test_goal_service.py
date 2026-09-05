import uuid
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

import pytest

from app.services.auth.auth_service import register_user
from app.services.goals.errors import (
    GoalNotActiveError,
    GoalNotFoundError,
    GoalValidationError,
    InsufficientAvailableBalanceError,
)
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
from app.services.wallets.errors import CurrencyMismatchError, WalletNotFoundError
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


# --- initial_amount -------------------------------------------------------------------


def test_create_goal_rejects_negative_initial_amount(db):
    with pytest.raises(GoalValidationError):
        create_goal(db, uuid.uuid4(), "MacBook", Decimal("1200"), "USD", _FUTURE, initial_amount=Decimal("-10"))


def test_create_goal_starts_with_the_initial_amount_already_saved(db):
    goal = create_goal(db, uuid.uuid4(), "MacBook", Decimal("1200"), "USD", _FUTURE, initial_amount=Decimal("700"))

    assert goal.total_saved == Decimal("700")
    assert goal.status == "active"


def test_create_goal_records_the_initial_amount_as_a_check_in_with_its_note(db):
    goal = create_goal(
        db,
        uuid.uuid4(),
        "MacBook",
        Decimal("1200"),
        "USD",
        _FUTURE,
        initial_amount=Decimal("700"),
        initial_amount_note="Si vendo mi laptop u otras pertenencias",
    )

    assert len(goal.check_ins) == 1
    check_in = goal.check_ins[0]
    assert check_in.amount_saved == Decimal("700")
    assert check_in.note == "Si vendo mi laptop u otras pertenencias"
    assert check_in.period_month == date.today().replace(day=1)


def test_create_goal_without_initial_amount_creates_no_check_in(db):
    goal = create_goal(db, uuid.uuid4(), "TV", Decimal("240"), "USD", _FUTURE)

    assert goal.check_ins == []


def test_create_goal_completes_instantly_when_initial_amount_covers_the_target(db):
    goal = create_goal(db, uuid.uuid4(), "MacBook", Decimal("700"), "USD", _FUTURE, initial_amount=Decimal("700"))

    assert goal.status == "completed"
    assert goal.completed_at is not None


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


# --- create_goal con initial_amount_wallet_id (reserva blanda) -----------------------
# Pedido explicito del usuario: "de donde lo voy a sacar, puede ser de alguna
# billetera... si no tengo dinero en esa billetera no se podria enlazar". Confirmado:
# nunca mueve plata real (wallet.balance no cambia), solo valida disponible.


def test_create_goal_with_wallet_link_does_not_touch_wallet_balance(db):
    user = register_user(db, "ana@example.com", "clave12345", "Ana")
    wallet = create_wallet(db, user.id, "Cash", "USD", Decimal("1000"))

    goal = create_goal(
        db, user.id, "TV", Decimal("240"), "USD", _FUTURE, initial_amount=Decimal("700"), initial_amount_wallet_id=wallet.id
    )

    db.refresh(wallet)
    assert wallet.balance == Decimal("1000")
    assert goal.total_saved == Decimal("700")
    check_in = goal.check_ins[0]
    assert check_in.wallet_id == wallet.id


def test_create_goal_rejects_a_wallet_without_enough_available_balance(db):
    user = register_user(db, "ana@example.com", "clave12345", "Ana")
    wallet = create_wallet(db, user.id, "Cash", "USD", Decimal("500"))

    with pytest.raises(InsufficientAvailableBalanceError):
        create_goal(
            db, user.id, "TV", Decimal("2000"), "USD", _FUTURE, initial_amount=Decimal("700"), initial_amount_wallet_id=wallet.id
        )


def test_create_goal_rejects_a_wallet_in_a_different_currency(db):
    user = register_user(db, "ana@example.com", "clave12345", "Ana")
    wallet = create_wallet(db, user.id, "Cash", "EUR", Decimal("1000"))

    with pytest.raises(CurrencyMismatchError):
        create_goal(
            db, user.id, "TV", Decimal("2000"), "USD", _FUTURE, initial_amount=Decimal("700"), initial_amount_wallet_id=wallet.id
        )


def test_create_goal_rejects_a_wallet_belonging_to_another_user(db):
    owner = register_user(db, "ana@example.com", "clave12345", "Ana")
    other = register_user(db, "beto@example.com", "clave12345", "Beto")
    wallet = create_wallet(db, other.id, "Cash", "USD", Decimal("1000"))

    with pytest.raises(WalletNotFoundError):
        create_goal(
            db, owner.id, "TV", Decimal("2000"), "USD", _FUTURE, initial_amount=Decimal("700"), initial_amount_wallet_id=wallet.id
        )


def test_create_goal_does_not_validate_a_wallet_when_initial_amount_is_zero(db):
    # Sin initial_amount, initial_amount_wallet_id no deberia validarse ni usarse -
    # no tiene sentido enlazar una billetera a un aporte de $0.
    user = register_user(db, "ana@example.com", "clave12345", "Ana")

    goal = create_goal(db, user.id, "TV", Decimal("240"), "USD", _FUTURE, initial_amount_wallet_id=uuid.uuid4())

    assert goal.check_ins == []


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
    assert capacity["has_enough_history"] is False


def test_get_savings_capacity_averages_income_and_expense_over_the_window(db):
    user = register_user(db, "ana@example.com", "clave12345", "Ana")
    user.created_at = datetime.now(timezone.utc) - timedelta(days=100)  # cuenta con >= 3 meses de antiguedad
    db.commit()
    wallet = create_wallet(db, user.id, "Cash", "USD")
    now = datetime.now(timezone.utc)
    create_transaction(db, user.id, wallet.id, "income", Decimal("900.00"), "Salario", occurred_at=now)
    create_transaction(db, user.id, wallet.id, "expense", Decimal("300.00"), "Comida", occurred_at=now)

    capacity = get_savings_capacity(db, user.id, months=3)

    # Solo el mes actual tiene movimientos, pero la cuenta ya existia en los otros 2 -
    # se promedia sobre los 3 meses completos de la ventana.
    assert capacity["avg_monthly_income"] == Decimal("300.00")
    assert capacity["avg_monthly_expense"] == Decimal("100.00")
    assert capacity["avg_monthly_available"] == Decimal("200.00")
    assert capacity["has_enough_history"] is True


def test_get_savings_capacity_does_not_dilute_a_brand_new_account_over_months_it_never_existed(db):
    """Bug real reportado por el usuario: una cuenta creada este mismo mes mostraba un
    "disponible promedio" absurdamente negativo porque un gasto real de este unico mes
    se dividia entre los 3 meses de la ventana - 2 de los cuales son anteriores a que
    la cuenta existiera. El promedio de una cuenta nueva debe basarse solo en los meses
    que realmente lleva existiendo, no en el largo fijo de la ventana."""
    user = register_user(db, "ana@example.com", "clave12345", "Ana")  # creada ahora mismo
    wallet = create_wallet(db, user.id, "Cash", "USD")
    now = datetime.now(timezone.utc)
    create_transaction(db, user.id, wallet.id, "expense", Decimal("5510.01"), "Compra", occurred_at=now)

    capacity = get_savings_capacity(db, user.id, months=3)

    assert capacity["avg_monthly_expense"] == Decimal("5510.01")
    assert capacity["avg_monthly_available"] == Decimal("-5510.01")
    # Segundo pedido del usuario: el mes actual todavia esta en curso - una sola
    # cifra parcial no es un "promedio" real, asi que el front no debe advertir
    # nada con esto todavia.
    assert capacity["has_enough_history"] is False


def test_get_savings_capacity_still_not_enough_history_with_a_single_full_prior_month(db):
    """Tercer pedido del usuario: 1 solo mes anterior completo (2 meses en total con el
    actual) tampoco alcanza - un ingreso/gasto puntual de "esto es lo que ya tenia
    ahorrado" cargado como transaccion (en vez de saldo inicial de billetera) todavia
    se veria como "el promedio" con una sola muestra. Hacen falta 2 meses anteriores
    completos, no 1."""
    user = register_user(db, "ana@example.com", "clave12345", "Ana")
    # Ultimo dia del mes calendario anterior - cae ahi sin importar que dia del mes es
    # "hoy" (a diferencia de un timedelta fijo, que podria no cruzar el limite del mes).
    last_day_of_previous_month = date.today().replace(day=1) - timedelta(days=1)
    user.created_at = datetime.combine(last_day_of_previous_month, datetime.min.time(), tzinfo=timezone.utc)
    db.commit()

    capacity = get_savings_capacity(db, user.id, months=3)

    assert capacity["has_enough_history"] is False


def test_get_savings_capacity_has_enough_history_with_two_full_prior_months(db):
    user = register_user(db, "ana@example.com", "clave12345", "Ana")
    # Ultimo dia de DOS meses calendario atras - 2 meses anteriores completos + el actual.
    first_of_previous_month = date.today().replace(day=1) - timedelta(days=1)
    last_day_two_months_ago = first_of_previous_month.replace(day=1) - timedelta(days=1)
    user.created_at = datetime.combine(last_day_two_months_ago, datetime.min.time(), tzinfo=timezone.utc)
    db.commit()

    capacity = get_savings_capacity(db, user.id, months=3)

    assert capacity["has_enough_history"] is True
