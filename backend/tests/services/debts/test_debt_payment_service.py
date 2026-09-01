import uuid
from datetime import date, timedelta
from decimal import Decimal

import pytest

from app.services.debts.debt_payment_service import create_debt_payment, delete_debt_payment
from app.services.debts.debt_service import create_debt, get_debt_paid_amount, get_debt_remaining_amount
from app.services.debts.errors import DebtNotFoundError, DebtValidationError
from app.services.wallets.errors import CurrencyMismatchError, InsufficientBalanceError
from app.services.wallets.wallet_service import create_wallet

# El fixture `db` vive en tests/conftest.py (ver test_debt_service.py) - user_id se usa
# como un uuid suelto porque las FK no se validan en SQLite/tests, mismo patrón ya
# establecido en test_debt_service.py.


def _make_debt(db, user_id, direction="owed_to_user", total_amount=Decimal("500"), currency="USD"):
    return create_debt(
        db,
        user_id=user_id,
        counterparty_name="Steven",
        direction=direction,
        total_amount=total_amount,
        currency=currency,
    )


def test_create_debt_payment_same_currency_defaults_applied_amount_to_amount(db):
    user_id = uuid.uuid4()
    debt = _make_debt(db, user_id)

    payment = create_debt_payment(db, debt.id, user_id, amount=Decimal("50"), currency="USD")

    assert payment.amount == Decimal("50")
    assert payment.applied_amount == Decimal("50")
    assert payment.paid_at == date.today()


def test_create_debt_payment_requires_applied_amount_when_currency_differs(db):
    user_id = uuid.uuid4()
    # VEF es una moneda flotante real (no atada al dolar como USDT) - a diferencia del
    # par USD/USDT, esta si necesita que el usuario escriba el equivalente a mano.
    debt = _make_debt(db, user_id, currency="USD")

    with pytest.raises(DebtValidationError):
        create_debt_payment(db, debt.id, user_id, amount=Decimal("50"), currency="VEF")


def test_create_debt_payment_accepts_a_manual_applied_amount_for_a_different_currency(db):
    user_id = uuid.uuid4()
    debt = _make_debt(db, user_id, currency="USD")

    payment = create_debt_payment(
        db, debt.id, user_id, amount=Decimal("50"), currency="VEF", applied_amount=Decimal("1.3")
    )

    assert payment.amount == Decimal("50")
    assert payment.currency == "VEF"
    assert payment.applied_amount == Decimal("1.3")


def test_create_debt_payment_defaults_applied_amount_to_amount_for_the_usd_usdt_peg(db):
    """Pedido explícito del usuario: "100$ equivale siempre a 100 usdt y viceversa" -
    a diferencia de otras monedas distintas a la de la deuda, este par nunca exige
    escribir el equivalente a mano, se asume 1:1 en ambos sentidos."""
    user_id = uuid.uuid4()

    debt_usd = _make_debt(db, user_id, currency="USD", total_amount=Decimal("500"))
    payment_usdt = create_debt_payment(db, debt_usd.id, user_id, amount=Decimal("50"), currency="USDT")
    assert payment_usdt.applied_amount == Decimal("50")

    debt_usdt = _make_debt(db, user_id, currency="USDT", total_amount=Decimal("500"))
    payment_usd = create_debt_payment(db, debt_usdt.id, user_id, amount=Decimal("50"), currency="USD")
    assert payment_usd.applied_amount == Decimal("50")


def test_create_debt_payment_still_accepts_a_manual_override_for_the_usd_usdt_peg(db):
    user_id = uuid.uuid4()
    debt = _make_debt(db, user_id, currency="USD")

    payment = create_debt_payment(
        db, debt.id, user_id, amount=Decimal("50"), currency="USDT", applied_amount=Decimal("49.8")
    )

    assert payment.applied_amount == Decimal("49.8")


def test_create_debt_payment_rejects_a_non_positive_amount(db):
    user_id = uuid.uuid4()
    debt = _make_debt(db, user_id)

    with pytest.raises(DebtValidationError):
        create_debt_payment(db, debt.id, user_id, amount=Decimal("0"), currency="USD")


def test_create_debt_payment_reduces_the_remaining_amount(db):
    user_id = uuid.uuid4()
    debt = _make_debt(db, user_id, total_amount=Decimal("500"))

    create_debt_payment(db, debt.id, user_id, amount=Decimal("50"), currency="USD")
    db.refresh(debt)

    assert get_debt_paid_amount(debt) == Decimal("50")
    assert get_debt_remaining_amount(debt) == Decimal("450")


def test_get_debt_remaining_amount_never_goes_negative_on_overpayment(db):
    user_id = uuid.uuid4()
    debt = _make_debt(db, user_id, total_amount=Decimal("100"))

    create_debt_payment(db, debt.id, user_id, amount=Decimal("150"), currency="USD")
    db.refresh(debt)

    assert get_debt_remaining_amount(debt) == Decimal("0")


def test_create_debt_payment_rejects_a_debt_owned_by_another_user(db):
    owner_id = uuid.uuid4()
    debt = _make_debt(db, owner_id)

    with pytest.raises(DebtNotFoundError):
        create_debt_payment(db, debt.id, uuid.uuid4(), amount=Decimal("50"), currency="USD")


def test_create_debt_payment_credits_the_wallet_when_someone_pays_the_user(db):
    user_id = uuid.uuid4()
    debt = _make_debt(db, user_id, direction="owed_to_user", currency="USDT")
    wallet = create_wallet(db, user_id, "Binance", "USDT", Decimal("10"))

    payment = create_debt_payment(db, debt.id, user_id, amount=Decimal("50"), currency="USDT", wallet_id=wallet.id)

    db.refresh(wallet)
    assert wallet.balance == Decimal("60")
    assert payment.wallet_id == wallet.id
    assert payment.transaction_id is not None


def test_create_debt_payment_debits_the_wallet_when_the_user_pays_their_own_debt(db):
    user_id = uuid.uuid4()
    debt = _make_debt(db, user_id, direction="owed_by_user", currency="USD")
    wallet = create_wallet(db, user_id, "Facebank", "USD", Decimal("100"))

    create_debt_payment(db, debt.id, user_id, amount=Decimal("40"), currency="USD", wallet_id=wallet.id)

    db.refresh(wallet)
    assert wallet.balance == Decimal("60")


def test_create_debt_payment_rejects_insufficient_balance_when_user_pays_their_own_debt(db):
    user_id = uuid.uuid4()
    debt = _make_debt(db, user_id, direction="owed_by_user", currency="USD")
    wallet = create_wallet(db, user_id, "Facebank", "USD", Decimal("10"))

    with pytest.raises(InsufficientBalanceError):
        create_debt_payment(db, debt.id, user_id, amount=Decimal("40"), currency="USD", wallet_id=wallet.id)


def test_create_debt_payment_rejects_a_wallet_in_a_different_currency(db):
    user_id = uuid.uuid4()
    debt = _make_debt(db, user_id, direction="owed_to_user", currency="USD")
    # La billetera esta en EUR, distinto de la moneda del PAGO (USD, la misma que la
    # deuda - asi no dispara primero el chequeo de applied_amount cruzado con la deuda).
    wallet = create_wallet(db, user_id, "Cuenta Euros", "EUR", Decimal("0"))

    with pytest.raises(CurrencyMismatchError):
        create_debt_payment(db, debt.id, user_id, amount=Decimal("50"), currency="USD", wallet_id=wallet.id)


def test_delete_debt_payment_reverses_the_wallet_credit(db):
    user_id = uuid.uuid4()
    debt = _make_debt(db, user_id, direction="owed_to_user", currency="USDT")
    wallet = create_wallet(db, user_id, "Binance", "USDT", Decimal("10"))
    payment = create_debt_payment(db, debt.id, user_id, amount=Decimal("50"), currency="USDT", wallet_id=wallet.id)

    delete_debt_payment(db, debt.id, payment.id, user_id)

    db.refresh(wallet)
    assert wallet.balance == Decimal("10")


def test_delete_debt_payment_reverses_the_wallet_debit(db):
    user_id = uuid.uuid4()
    debt = _make_debt(db, user_id, direction="owed_by_user", currency="USD")
    wallet = create_wallet(db, user_id, "Facebank", "USD", Decimal("100"))
    payment = create_debt_payment(db, debt.id, user_id, amount=Decimal("40"), currency="USD", wallet_id=wallet.id)

    delete_debt_payment(db, debt.id, payment.id, user_id)

    db.refresh(wallet)
    assert wallet.balance == Decimal("100")


def test_delete_debt_payment_rejects_a_payment_that_does_not_belong_to_the_debt(db):
    user_id = uuid.uuid4()
    debt = _make_debt(db, user_id)
    other_debt = _make_debt(db, user_id, total_amount=Decimal("100"))
    payment = create_debt_payment(db, other_debt.id, user_id, amount=Decimal("50"), currency="USD")

    with pytest.raises(DebtNotFoundError):
        delete_debt_payment(db, debt.id, payment.id, user_id)


def test_paid_at_defaults_to_a_given_past_date(db):
    user_id = uuid.uuid4()
    debt = _make_debt(db, user_id)
    yesterday = date.today() - timedelta(days=1)

    payment = create_debt_payment(db, debt.id, user_id, amount=Decimal("50"), currency="USD", paid_at=yesterday)

    assert payment.paid_at == yesterday
