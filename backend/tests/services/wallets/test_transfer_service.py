from decimal import Decimal

import pytest

from app.services.auth.auth_service import register_user
from app.services.transactions.transaction_service import list_transactions_for_user
from app.services.wallets.errors import CurrencyMismatchError, InsufficientBalanceError, WalletNotFoundError
from app.services.wallets.transfer_service import execute_transfer
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
