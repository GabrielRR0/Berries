import uuid
from datetime import datetime, timezone
from decimal import Decimal

import pytest

from app.services.auth.auth_service import register_user
from app.services.transactions.transaction_service import list_transactions_for_user
from app.services.wallets.errors import (
    CurrencyMismatchError,
    InsufficientBalanceError,
    TransferNotFoundError,
    WalletNotFoundError,
)
from app.services.wallets.transfer_service import FEE_CATEGORY, TRANSFER_CATEGORY, execute_transfer, update_transfer
from app.services.wallets.wallet_service import create_wallet


def _user(db, email="ana@example.com"):
    return register_user(db, email, "clave12345", "Ana")


def _funded_wallet(db, user_id, name, currency, balance):
    wallet = create_wallet(db, user_id, name, currency)
    wallet.balance = Decimal(balance)
    db.commit()
    db.refresh(wallet)
    return wallet


def test_transfer_same_currency_moves_balance(db):
    user = _user(db)
    cash = _funded_wallet(db, user.id, "Cash", "USD", "100.00")
    bank = _funded_wallet(db, user.id, "Banco", "USD", "0.00")

    from_wallet, to_wallet = execute_transfer(db, user.id, cash.id, bank.id, Decimal("40.00"))

    assert from_wallet.balance == Decimal("60.00")
    assert to_wallet.balance == Decimal("40.00")


def test_transfer_same_currency_applies_fee_only_to_sender(db):
    user = _user(db)
    cash = _funded_wallet(db, user.id, "Cash", "USD", "100.00")
    bank = _funded_wallet(db, user.id, "Banco", "USD", "0.00")

    from_wallet, to_wallet = execute_transfer(db, user.id, cash.id, bank.id, Decimal("40.00"), fee=Decimal("2.00"))

    assert from_wallet.balance == Decimal("58.00")
    assert to_wallet.balance == Decimal("40.00")


def test_transfer_rejects_insufficient_balance(db):
    user = _user(db)
    cash = _funded_wallet(db, user.id, "Cash", "USD", "10.00")
    bank = _funded_wallet(db, user.id, "Banco", "USD", "0.00")

    with pytest.raises(InsufficientBalanceError):
        execute_transfer(db, user.id, cash.id, bank.id, Decimal("40.00"))


def test_transfer_cross_currency_requires_converted_amount(db):
    user = _user(db)
    cash = _funded_wallet(db, user.id, "Cash", "USD", "100.00")
    bank = _funded_wallet(db, user.id, "Banco", "VEF", "0.00")

    with pytest.raises(CurrencyMismatchError):
        execute_transfer(db, user.id, cash.id, bank.id, Decimal("10.00"))


def test_transfer_cross_currency_uses_converted_amount(db):
    user = _user(db)
    cash = _funded_wallet(db, user.id, "Cash", "USD", "100.00")
    bank = _funded_wallet(db, user.id, "Banco", "VEF", "0.00")

    from_wallet, to_wallet = execute_transfer(
        db, user.id, cash.id, bank.id, Decimal("10.00"), converted_amount=Decimal("365.00")
    )

    assert from_wallet.balance == Decimal("90.00")
    assert to_wallet.balance == Decimal("365.00")


def test_transfer_rejects_wallet_not_owned_by_user(db):
    user_a = _user(db, "a@example.com")
    user_b = _user(db, "b@example.com")
    cash_a = _funded_wallet(db, user_a.id, "Cash", "USD", "100.00")
    bank_b = _funded_wallet(db, user_b.id, "Banco", "USD", "0.00")

    with pytest.raises(WalletNotFoundError):
        execute_transfer(db, user_a.id, cash_a.id, bank_b.id, Decimal("10.00"))


def test_transfer_without_fee_creates_only_the_paired_legs(db):
    user = _user(db)
    cash = _funded_wallet(db, user.id, "FaceBank", "USD", "100.00")
    bank = _funded_wallet(db, user.id, "Binance USDT", "USD", "0.00")

    execute_transfer(db, user.id, cash.id, bank.id, Decimal("40.00"))

    transactions = list_transactions_for_user(db, user.id)
    assert len(transactions) == 2

    expense_leg = next(t for t in transactions if t.type == "expense")
    income_leg = next(t for t in transactions if t.type == "income")

    assert expense_leg.wallet_id == cash.id
    assert expense_leg.amount == Decimal("40.00")
    assert expense_leg.source == "transfer"
    assert expense_leg.category == "Transferencia"
    assert expense_leg.description == "Transferencia a Binance USDT"

    assert income_leg.wallet_id == bank.id
    assert income_leg.amount == Decimal("40.00")
    assert income_leg.source == "transfer"
    assert income_leg.description == "Transferencia desde FaceBank"

    # Comparten el mismo transfer_id (ver transaction_service.delete_transaction,
    # que borra ambas patas juntas usando esta misma clave).
    assert expense_leg.transfer_id is not None
    assert expense_leg.transfer_id == income_leg.transfer_id


def test_transfer_with_fee_creates_a_separate_real_expense_row(db):
    user = _user(db)
    cash = _funded_wallet(db, user.id, "FaceBank", "USD", "100.00")
    bank = _funded_wallet(db, user.id, "Binance USDT", "USD", "0.00")

    execute_transfer(db, user.id, cash.id, bank.id, Decimal("40.00"), fee=Decimal("2.00"))

    transactions = list_transactions_for_user(db, user.id)
    assert len(transactions) == 3

    transfer_leg = next(t for t in transactions if t.type == "expense" and t.category == "Transferencia")
    fee_leg = next(t for t in transactions if t.category == "Comisión")
    income_leg = next(t for t in transactions if t.type == "income")

    # La pata "Transferencia" del emisor solo lleva el principal - la comision queda
    # desglosada en su propia fila, no sumada en silencio (pedido explicito del
    # usuario: "el gasto sería en toda la comisión que se ha gastado").
    assert transfer_leg.amount == Decimal("40.00")
    assert transfer_leg.source == "transfer"

    assert fee_leg.wallet_id == cash.id
    assert fee_leg.type == "expense"
    assert fee_leg.amount == Decimal("2.00")
    # source="manual" (no "transfer"): a diferencia de las 2 patas de la
    # transferencia, la comision SI es un gasto real - debe contar en
    # Analisis/Metas y verse en Movimientos como cualquier otro gasto manual.
    assert fee_leg.source == "manual"
    assert fee_leg.transfer_id == transfer_leg.transfer_id

    assert income_leg.amount == Decimal("40.00")


def test_transfer_without_fee_does_not_create_a_fee_row(db):
    user = _user(db)
    cash = _funded_wallet(db, user.id, "Cash", "USD", "100.00")
    bank = _funded_wallet(db, user.id, "Banco", "USD", "0.00")

    execute_transfer(db, user.id, cash.id, bank.id, Decimal("40.00"), fee=Decimal("0.00"))

    transactions = list_transactions_for_user(db, user.id)
    assert all(t.category != "Comisión" for t in transactions)


def test_transfer_paired_transaction_uses_converted_amount_cross_currency(db):
    user = _user(db)
    cash = _funded_wallet(db, user.id, "Cash", "USD", "100.00")
    bank = _funded_wallet(db, user.id, "Banco", "VEF", "0.00")

    execute_transfer(db, user.id, cash.id, bank.id, Decimal("10.00"), converted_amount=Decimal("365.00"))

    transactions = list_transactions_for_user(db, user.id)
    income_leg = next(t for t in transactions if t.type == "income")
    expense_leg = next(t for t in transactions if t.type == "expense")

    assert income_leg.amount == Decimal("365.00")
    assert expense_leg.amount == Decimal("10.00")


# Pedido explicito del usuario: poder elegir la fecha de una transferencia
# (backdatearla), no solo "ahora".
def test_transfer_accepts_an_explicit_occurred_at(db):
    user = _user(db)
    cash = _funded_wallet(db, user.id, "Cash", "USD", "100.00")
    bank = _funded_wallet(db, user.id, "Banco", "USD", "0.00")
    backdated = datetime(2026, 1, 15, 12, 0, tzinfo=timezone.utc)

    execute_transfer(db, user.id, cash.id, bank.id, Decimal("40.00"), occurred_at=backdated)

    # SQLite (base de tests) pierde el tzinfo al hacer el roundtrip por una
    # columna DateTime(timezone=True) - Postgres (produccion) lo conserva.
    transactions = list_transactions_for_user(db, user.id)
    assert all(t.occurred_at.replace(tzinfo=timezone.utc) == backdated for t in transactions)


def _transfer_id_of(db, user_id):
    transactions = list_transactions_for_user(db, user_id)
    expense_leg = next(t for t in transactions if t.type == "expense" and t.category == TRANSFER_CATEGORY)
    return expense_leg.transfer_id


# update_transfer - pedido explicito del usuario ("que se pueda editar esto [la
# fecha] y también los montos"), a diferencia de update_transaction (que rechaza
# cualquier pata de transferencia).
def test_update_transfer_changes_amount_and_date_same_currency(db):
    user = _user(db)
    cash = _funded_wallet(db, user.id, "Cash", "USD", "100.00")
    bank = _funded_wallet(db, user.id, "Banco", "USD", "0.00")
    execute_transfer(db, user.id, cash.id, bank.id, Decimal("40.00"))
    transfer_id = _transfer_id_of(db, user.id)
    new_date = datetime(2026, 2, 1, 9, 0, tzinfo=timezone.utc)

    from_wallet, to_wallet = update_transfer(db, user.id, transfer_id, Decimal("60.00"), new_date)

    assert from_wallet.balance == Decimal("40.00")
    assert to_wallet.balance == Decimal("60.00")

    transactions = list_transactions_for_user(db, user.id)
    assert all(t.amount == Decimal("60.00") and t.occurred_at.replace(tzinfo=timezone.utc) == new_date for t in transactions)


def test_update_transfer_can_add_a_fee_that_did_not_exist(db):
    user = _user(db)
    cash = _funded_wallet(db, user.id, "Cash", "USD", "100.00")
    bank = _funded_wallet(db, user.id, "Banco", "USD", "0.00")
    execute_transfer(db, user.id, cash.id, bank.id, Decimal("40.00"))
    transfer_id = _transfer_id_of(db, user.id)

    from_wallet, to_wallet = update_transfer(
        db, user.id, transfer_id, Decimal("40.00"), datetime.now(timezone.utc), fee=Decimal("3.00")
    )

    assert from_wallet.balance == Decimal("57.00")
    assert to_wallet.balance == Decimal("40.00")

    transactions = list_transactions_for_user(db, user.id)
    assert len(transactions) == 3
    fee_leg = next(t for t in transactions if t.category == FEE_CATEGORY)
    assert fee_leg.amount == Decimal("3.00")
    assert fee_leg.wallet_id == cash.id
    assert fee_leg.source == "manual"
    assert fee_leg.transfer_id == transfer_id


def test_update_transfer_can_remove_an_existing_fee(db):
    user = _user(db)
    cash = _funded_wallet(db, user.id, "Cash", "USD", "100.00")
    bank = _funded_wallet(db, user.id, "Banco", "USD", "0.00")
    execute_transfer(db, user.id, cash.id, bank.id, Decimal("40.00"), fee=Decimal("2.00"))
    transfer_id = _transfer_id_of(db, user.id)

    from_wallet, to_wallet = update_transfer(
        db, user.id, transfer_id, Decimal("40.00"), datetime.now(timezone.utc), fee=Decimal("0")
    )

    assert from_wallet.balance == Decimal("60.00")
    assert to_wallet.balance == Decimal("40.00")

    transactions = list_transactions_for_user(db, user.id)
    assert len(transactions) == 2
    assert all(t.category != FEE_CATEGORY for t in transactions)


def test_update_transfer_updates_an_existing_fee_amount_in_place(db):
    user = _user(db)
    cash = _funded_wallet(db, user.id, "Cash", "USD", "100.00")
    bank = _funded_wallet(db, user.id, "Banco", "USD", "0.00")
    execute_transfer(db, user.id, cash.id, bank.id, Decimal("40.00"), fee=Decimal("2.00"))
    transfer_id = _transfer_id_of(db, user.id)

    from_wallet, to_wallet = update_transfer(
        db, user.id, transfer_id, Decimal("30.00"), datetime.now(timezone.utc), fee=Decimal("5.00")
    )

    assert from_wallet.balance == Decimal("65.00")
    assert to_wallet.balance == Decimal("30.00")

    transactions = list_transactions_for_user(db, user.id)
    assert len(transactions) == 3
    fee_leg = next(t for t in transactions if t.category == FEE_CATEGORY)
    assert fee_leg.amount == Decimal("5.00")


def test_update_transfer_cross_currency_uses_the_new_converted_amount(db):
    user = _user(db)
    cash = _funded_wallet(db, user.id, "Cash", "USD", "100.00")
    bank = _funded_wallet(db, user.id, "Banco", "VEF", "0.00")
    execute_transfer(db, user.id, cash.id, bank.id, Decimal("10.00"), converted_amount=Decimal("365.00"))
    transfer_id = _transfer_id_of(db, user.id)

    from_wallet, to_wallet = update_transfer(
        db, user.id, transfer_id, Decimal("20.00"), datetime.now(timezone.utc), converted_amount=Decimal("700.00")
    )

    assert from_wallet.balance == Decimal("80.00")
    assert to_wallet.balance == Decimal("700.00")


def test_update_transfer_cross_currency_requires_converted_amount(db):
    user = _user(db)
    cash = _funded_wallet(db, user.id, "Cash", "USD", "100.00")
    bank = _funded_wallet(db, user.id, "Banco", "VEF", "0.00")
    execute_transfer(db, user.id, cash.id, bank.id, Decimal("10.00"), converted_amount=Decimal("365.00"))
    transfer_id = _transfer_id_of(db, user.id)

    with pytest.raises(CurrencyMismatchError):
        update_transfer(db, user.id, transfer_id, Decimal("20.00"), datetime.now(timezone.utc))


def test_update_transfer_rejects_insufficient_balance_with_the_new_amount(db):
    user = _user(db)
    cash = _funded_wallet(db, user.id, "Cash", "USD", "50.00")
    bank = _funded_wallet(db, user.id, "Banco", "USD", "0.00")
    execute_transfer(db, user.id, cash.id, bank.id, Decimal("10.00"))
    transfer_id = _transfer_id_of(db, user.id)

    with pytest.raises(InsufficientBalanceError):
        update_transfer(db, user.id, transfer_id, Decimal("1000.00"), datetime.now(timezone.utc))


def test_update_transfer_raises_not_found_for_an_unknown_transfer_id(db):
    user = _user(db)

    with pytest.raises(TransferNotFoundError):
        update_transfer(db, user.id, uuid.uuid4(), Decimal("10.00"), datetime.now(timezone.utc))


def test_update_transfer_raises_not_found_for_another_users_transfer(db):
    user_a = _user(db, "a@example.com")
    user_b = _user(db, "b@example.com")
    cash_a = _funded_wallet(db, user_a.id, "Cash", "USD", "100.00")
    bank_a = _funded_wallet(db, user_a.id, "Banco", "USD", "0.00")
    execute_transfer(db, user_a.id, cash_a.id, bank_a.id, Decimal("10.00"))
    transfer_id = _transfer_id_of(db, user_a.id)

    with pytest.raises(TransferNotFoundError):
        update_transfer(db, user_b.id, transfer_id, Decimal("20.00"), datetime.now(timezone.utc))
