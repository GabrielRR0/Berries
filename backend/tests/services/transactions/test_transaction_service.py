from datetime import datetime, timedelta, timezone
from decimal import Decimal

import pytest

from app.services.auth.auth_service import register_user
from app.services.transactions.errors import TransactionValidationError
from app.services.transactions.transaction_service import (
    create_transaction,
    delete_transaction,
    list_transactions_for_user,
)
from app.services.wallets.transfer_service import execute_transfer
from app.services.wallets.wallet_service import create_wallet


def _user(db, email="ana@example.com"):
    return register_user(db, email, "clave12345", "Ana")


def test_create_transaction_expense_decreases_wallet_balance(db):
    user = _user(db)
    wallet = create_wallet(db, user.id, "Cash", "USD")
    wallet.balance = Decimal("100.00")
    db.commit()

    create_transaction(db, user.id, wallet.id, "expense", Decimal("30.00"), "Mercado")

    db.refresh(wallet)
    assert wallet.balance == Decimal("70.00")


def test_create_transaction_income_increases_wallet_balance(db):
    user = _user(db)
    wallet = create_wallet(db, user.id, "Cash", "USD")

    create_transaction(db, user.id, wallet.id, "income", Decimal("500.00"), "Ingreso")

    db.refresh(wallet)
    assert wallet.balance == Decimal("500.00")


def test_create_transaction_rejects_non_positive_amount(db):
    user = _user(db)
    wallet = create_wallet(db, user.id, "Cash", "USD")

    with pytest.raises(TransactionValidationError):
        create_transaction(db, user.id, wallet.id, "expense", Decimal("0"), "Mercado")


def test_create_transaction_rejects_wallet_not_owned_by_user(db):
    user_a = _user(db, "a@example.com")
    user_b = _user(db, "b@example.com")
    wallet_b = create_wallet(db, user_b.id, "Cash", "USD")

    with pytest.raises(TransactionValidationError):
        create_transaction(db, user_a.id, wallet_b.id, "expense", Decimal("10.00"), "Mercado")


def test_delete_transaction_reverses_expense_delta(db):
    user = _user(db)
    wallet = create_wallet(db, user.id, "Cash", "USD")
    wallet.balance = Decimal("100.00")
    db.commit()
    transaction = create_transaction(db, user.id, wallet.id, "expense", Decimal("30.00"), "Mercado")

    delete_transaction(db, transaction.id, user.id)

    db.refresh(wallet)
    assert wallet.balance == Decimal("100.00")


def test_delete_transaction_reverses_income_delta(db):
    user = _user(db)
    wallet = create_wallet(db, user.id, "Cash", "USD")
    transaction = create_transaction(db, user.id, wallet.id, "income", Decimal("500.00"), "Ingreso")

    delete_transaction(db, transaction.id, user.id)

    db.refresh(wallet)
    assert wallet.balance == Decimal("0.00")


def test_delete_transaction_rejects_other_users_transaction(db):
    user_a = _user(db, "a@example.com")
    user_b = _user(db, "b@example.com")
    wallet_a = create_wallet(db, user_a.id, "Cash", "USD")
    transaction = create_transaction(db, user_a.id, wallet_a.id, "income", Decimal("500.00"), "Ingreso")

    with pytest.raises(TransactionValidationError):
        delete_transaction(db, transaction.id, user_b.id)


def test_delete_transaction_of_a_transfer_leg_deletes_both_and_reverses_both_balances(db):
    user = _user(db)
    cash = create_wallet(db, user.id, "Cash", "USD")
    cash.balance = Decimal("100.00")
    bank = create_wallet(db, user.id, "Banco", "USD")
    db.commit()

    execute_transfer(db, user.id, cash.id, bank.id, Decimal("40.00"))
    db.refresh(cash)
    db.refresh(bank)
    assert cash.balance == Decimal("60.00")
    assert bank.balance == Decimal("40.00")

    expense_leg = next(t for t in list_transactions_for_user(db, user.id) if t.wallet_id == cash.id)
    delete_transaction(db, expense_leg.id, user.id)

    db.refresh(cash)
    db.refresh(bank)
    assert cash.balance == Decimal("100.00")
    assert bank.balance == Decimal("0.00")
    assert list_transactions_for_user(db, user.id) == []


def test_list_transactions_filters_by_wallet_category_and_date(db):
    user = _user(db)
    wallet_1 = create_wallet(db, user.id, "Cash", "USD")
    wallet_2 = create_wallet(db, user.id, "Banco", "USD")
    now = datetime.now(timezone.utc)

    create_transaction(
        db, user.id, wallet_1.id, "expense", Decimal("10.00"), "Mercado", occurred_at=now - timedelta(days=10)
    )
    create_transaction(db, user.id, wallet_1.id, "expense", Decimal("20.00"), "Transporte", occurred_at=now)
    create_transaction(db, user.id, wallet_2.id, "income", Decimal("500.00"), "Ingreso", occurred_at=now)

    by_wallet = list_transactions_for_user(db, user.id, wallet_id=wallet_1.id)
    assert len(by_wallet) == 2

    by_category = list_transactions_for_user(db, user.id, category="Transporte")
    assert len(by_category) == 1
    assert by_category[0].category == "Transporte"

    by_date = list_transactions_for_user(db, user.id, date_from=now - timedelta(days=1))
    assert len(by_date) == 2
