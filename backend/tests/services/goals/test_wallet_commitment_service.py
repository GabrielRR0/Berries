from datetime import date, timedelta
from decimal import Decimal

import pytest

from app.services.auth.auth_service import register_user
from app.services.goals.check_in_service import record_check_in
from app.services.goals.errors import InsufficientAvailableBalanceError
from app.services.goals.goal_service import create_goal
from app.services.wallets.errors import CurrencyMismatchError
from app.services.wallets.wallet_service import create_wallet
from app.services.goals.wallet_commitment_service import (
    get_available_balance,
    get_committed_amounts_for_user,
    validate_and_get_wallet_for_commitment,
)

_FUTURE = date.today() + timedelta(days=90)


def test_get_committed_amounts_sums_across_multiple_goals_for_one_wallet(db):
    user = register_user(db, "ana@example.com", "clave12345", "Ana")
    wallet = create_wallet(db, user.id, "Cash", "USD", Decimal("1000"))
    goal_a = create_goal(db, user.id, "TV", Decimal("500"), "USD", _FUTURE)
    goal_b = create_goal(db, user.id, "Moto", Decimal("2000"), "USD", _FUTURE)
    record_check_in(db, goal_a.id, user.id, amount_saved=Decimal("100"), wallet_id=wallet.id)
    record_check_in(db, goal_b.id, user.id, amount_saved=Decimal("50"), wallet_id=wallet.id)

    committed = get_committed_amounts_for_user(db, user.id)

    assert committed[wallet.id] == Decimal("150")


def test_get_committed_amounts_excludes_unlinked_check_ins(db):
    user = register_user(db, "ana@example.com", "clave12345", "Ana")
    wallet = create_wallet(db, user.id, "Cash", "USD", Decimal("1000"))
    goal = create_goal(db, user.id, "TV", Decimal("500"), "USD", _FUTURE)
    record_check_in(db, goal.id, user.id, amount_saved=Decimal("100"))  # sin wallet_id ("ingreso futuro")

    committed = get_committed_amounts_for_user(db, user.id)

    assert wallet.id not in committed


def test_get_committed_amounts_excludes_completed_and_abandoned_goals(db):
    """Completar/abandonar una meta libera su reserva - mismo criterio que
    goal_service.get_goal_summary, que ya solo suma metas activas."""
    user = register_user(db, "ana@example.com", "clave12345", "Ana")
    wallet = create_wallet(db, user.id, "Cash", "USD", Decimal("1000"))
    completed_goal = create_goal(db, user.id, "TV", Decimal("100"), "USD", _FUTURE)
    record_check_in(db, completed_goal.id, user.id, amount_saved=Decimal("100"), wallet_id=wallet.id)
    abandoned_goal = create_goal(db, user.id, "Moto", Decimal("2000"), "USD", _FUTURE)
    record_check_in(db, abandoned_goal.id, user.id, amount_saved=Decimal("50"), wallet_id=wallet.id)
    abandoned_goal.status = "abandoned"
    db.commit()

    committed = get_committed_amounts_for_user(db, user.id)

    assert wallet.id not in committed


def test_get_committed_amounts_excludes_other_users(db):
    owner = register_user(db, "ana@example.com", "clave12345", "Ana")
    other = register_user(db, "beto@example.com", "clave12345", "Beto")
    owner_wallet = create_wallet(db, owner.id, "Cash", "USD", Decimal("1000"))
    other_goal = create_goal(db, other.id, "TV", Decimal("500"), "USD", _FUTURE)
    other_wallet = create_wallet(db, other.id, "Cash", "USD", Decimal("1000"))
    record_check_in(db, other_goal.id, other.id, amount_saved=Decimal("100"), wallet_id=other_wallet.id)

    committed = get_committed_amounts_for_user(db, owner.id)

    assert owner_wallet.id not in committed
    assert other_wallet.id not in committed


def test_get_available_balance_subtracts_committed_from_real_balance(db):
    user = register_user(db, "ana@example.com", "clave12345", "Ana")
    wallet = create_wallet(db, user.id, "Cash", "USD", Decimal("1000"))
    goal = create_goal(db, user.id, "TV", Decimal("500"), "USD", _FUTURE)
    record_check_in(db, goal.id, user.id, amount_saved=Decimal("300"), wallet_id=wallet.id)

    available = get_available_balance(db, user.id, wallet)

    assert available == Decimal("700")


def test_get_available_balance_with_exclude_check_in_id_adds_back_its_own_amount(db):
    user = register_user(db, "ana@example.com", "clave12345", "Ana")
    wallet = create_wallet(db, user.id, "Cash", "USD", Decimal("1000"))
    goal = create_goal(db, user.id, "TV", Decimal("500"), "USD", _FUTURE)
    check_in = record_check_in(db, goal.id, user.id, amount_saved=Decimal("300"), wallet_id=wallet.id)

    available = get_available_balance(db, user.id, wallet, exclude_check_in_id=check_in.id)

    assert available == Decimal("1000")


def test_validate_and_get_wallet_for_commitment_rejects_insufficient_available(db):
    user = register_user(db, "ana@example.com", "clave12345", "Ana")
    wallet = create_wallet(db, user.id, "Cash", "USD", Decimal("100"))

    with pytest.raises(InsufficientAvailableBalanceError):
        validate_and_get_wallet_for_commitment(db, user.id, wallet.id, "USD", Decimal("150"))


# Pedido explicito del usuario: "en billetera no me deja usar usdt, seria bueno que si
# es dolares, acepte dolares y usdt" - mismo criterio 1:1 ya establecido para deudas
# (ver debt_payment_service.py/pegged_currencies.py).
def test_validate_and_get_wallet_for_commitment_accepts_usdt_wallet_for_a_usd_goal(db):
    user = register_user(db, "ana@example.com", "clave12345", "Ana")
    wallet = create_wallet(db, user.id, "Binance", "USDT", Decimal("100"))

    result = validate_and_get_wallet_for_commitment(db, user.id, wallet.id, "USD", Decimal("50"))

    assert result.id == wallet.id


def test_validate_and_get_wallet_for_commitment_accepts_usd_wallet_for_a_usdt_goal(db):
    user = register_user(db, "ana@example.com", "clave12345", "Ana")
    wallet = create_wallet(db, user.id, "Cash", "USD", Decimal("100"))

    result = validate_and_get_wallet_for_commitment(db, user.id, wallet.id, "USDT", Decimal("50"))

    assert result.id == wallet.id


def test_validate_and_get_wallet_for_commitment_still_rejects_a_non_pegged_mismatch(db):
    user = register_user(db, "ana@example.com", "clave12345", "Ana")
    wallet = create_wallet(db, user.id, "Cash", "EUR", Decimal("100"))

    with pytest.raises(CurrencyMismatchError):
        validate_and_get_wallet_for_commitment(db, user.id, wallet.id, "USD", Decimal("50"))
