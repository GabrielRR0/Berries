from datetime import datetime, timedelta, timezone
from decimal import Decimal

import pytest

from app.models.currency.exchange_rate_model import ExchangeRate
from app.services.auth.auth_service import register_user
from app.services.currency.currency_lookup import get_currency_by_code
from app.services.transactions.errors import TransactionValidationError
from app.services.transactions.transaction_service import (
    backfill_reference_amounts,
    create_transaction,
    delete_transaction,
    list_transactions_for_user,
    update_transaction,
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


# --- reference_amount_usd (pedido explícito del usuario: para una wallet en una
# moneda nacional con inflación fuerte - VEF, COP, ARS... - quiere un registro FIJO de
# "cuánto era eso ese día", que nunca cambie con el tiempo) ---------------------------


def test_create_transaction_leaves_reference_amount_none_for_a_usd_wallet(db):
    user = _user(db)
    wallet = create_wallet(db, user.id, "Cash", "USD")

    transaction = create_transaction(db, user.id, wallet.id, "expense", Decimal("30.00"), "Mercado")

    assert transaction.reference_amount_usd is None


def test_create_transaction_freezes_a_reference_amount_in_usd_for_a_non_usd_wallet(db):
    # La tasa VEF real depende de un servicio externo mockeado a 36.5 en todos los
    # tests (ver el fixture autouse _mock_vef_rate en conftest.py).
    user = _user(db)
    wallet = create_wallet(db, user.id, "Banco Vnz", "VEF")

    transaction = create_transaction(db, user.id, wallet.id, "expense", Decimal("4082"), "Mercado")

    assert transaction.reference_amount_usd == Decimal("4082") / Decimal("36.5")


def test_create_transaction_uses_the_historical_rate_of_its_own_occurred_at_not_todays(db):
    """Bug real que este campo existe para evitar: un gasto backdateado (ver el campo
    de fecha de TransactionForm.vue) debe congelar la tasa vigente EN esa fecha, no la
    de "ahora" - mismo criterio que get_conversion_rate_at usa para analytics_service.py."""
    user = _user(db)
    wallet = create_wallet(db, user.id, "Banco Vnz", "VEF")
    vef = get_currency_by_code(db, "VEF")
    usd = get_currency_by_code(db, "USD")
    old_date = datetime(2026, 6, 1, tzinfo=timezone.utc)
    # 1 VEF = 1/50 USD en esa fecha vieja - bien distinto del mock "de hoy" (1/36.5).
    db.add(ExchangeRate(base_currency_id=vef.id, quote_currency_id=usd.id, rate=Decimal("1") / Decimal("50"), fetched_at=old_date))
    db.commit()

    transaction = create_transaction(
        db, user.id, wallet.id, "expense", Decimal("500"), "Mercado", occurred_at=datetime(2026, 6, 15, tzinfo=timezone.utc)
    )

    assert transaction.reference_amount_usd == Decimal("500") / Decimal("50")


def test_create_transaction_reference_amount_survives_a_later_change_in_ttl_cached_rate(db):
    """Confirma que el valor queda REALMENTE congelado en la fila - crear una segunda
    transaction con una tasa distinta no debe alterar la primera ya guardada."""
    user = _user(db)
    wallet = create_wallet(db, user.id, "Banco Vnz", "VEF")
    vef = get_currency_by_code(db, "VEF")
    usd = get_currency_by_code(db, "USD")

    first = create_transaction(db, user.id, wallet.id, "expense", Decimal("1000"), "Mercado")
    first_reference = first.reference_amount_usd

    # Simula que la tasa cambió mucho después (ej. el cron diario la refrescó).
    db.add(ExchangeRate(base_currency_id=vef.id, quote_currency_id=usd.id, rate=Decimal("1") / Decimal("900"), fetched_at=datetime.now(timezone.utc)))
    db.commit()
    create_transaction(db, user.id, wallet.id, "expense", Decimal("1000"), "Mercado")

    db.refresh(first)
    assert first.reference_amount_usd == first_reference


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


# --- update_transaction (pedido explícito del usuario: "se debe poder editar los
# movimientos... montos, fecha de pago, description, wallet_id, category") -----------


def test_update_transaction_changes_amount_category_description_and_date(db):
    user = _user(db)
    wallet = create_wallet(db, user.id, "Cash", "USD")
    wallet.balance = Decimal("100.00")
    db.commit()
    transaction = create_transaction(db, user.id, wallet.id, "expense", Decimal("30.00"), "Mercado")
    new_date = datetime(2026, 1, 15, tzinfo=timezone.utc)

    updated = update_transaction(
        db, transaction.id, user.id, wallet.id, "expense", Decimal("45.00"), "Transporte", "Taxi", new_date
    )

    assert updated.amount == Decimal("45.00")
    assert updated.category == "Transporte"
    assert updated.description == "Taxi"
    # SQLite (motor de test) no preserva tzinfo en un DateTime(timezone=True) al
    # releer de la base - Postgres (motor real) sí. Se agrega de vuelta para comparar
    # el mismo instante, no una diferencia de tzinfo que no existiría en producción.
    assert updated.occurred_at.replace(tzinfo=timezone.utc) == new_date
    db.refresh(wallet)
    assert wallet.balance == Decimal("55.00")  # 100 - 45 (no 100 - 30 - 45)


def test_update_transaction_moves_the_delta_to_a_new_wallet(db):
    user = _user(db)
    old_wallet = create_wallet(db, user.id, "Cash", "USD")
    old_wallet.balance = Decimal("100.00")
    new_wallet = create_wallet(db, user.id, "Banco", "USD")
    new_wallet.balance = Decimal("50.00")
    db.commit()
    transaction = create_transaction(db, user.id, old_wallet.id, "expense", Decimal("30.00"), "Mercado")

    update_transaction(
        db, transaction.id, user.id, new_wallet.id, "expense", Decimal("30.00"), "Mercado", None, transaction.occurred_at
    )

    db.refresh(old_wallet)
    db.refresh(new_wallet)
    assert old_wallet.balance == Decimal("100.00")  # revertido
    assert new_wallet.balance == Decimal("20.00")  # 50 - 30


def test_update_transaction_changing_type_applies_the_new_delta_correctly(db):
    user = _user(db)
    wallet = create_wallet(db, user.id, "Cash", "USD")
    transaction = create_transaction(db, user.id, wallet.id, "expense", Decimal("30.00"), "Mercado")
    db.refresh(wallet)
    assert wallet.balance == Decimal("-30.00")

    update_transaction(
        db, transaction.id, user.id, wallet.id, "income", Decimal("30.00"), "Ajuste", None, transaction.occurred_at
    )

    db.refresh(wallet)
    assert wallet.balance == Decimal("30.00")  # revierte el -30 (+30) y aplica +30 = 30


def test_update_transaction_recomputes_reference_amount_for_the_new_currency_and_date(db):
    user = _user(db)
    usd_wallet = create_wallet(db, user.id, "Cash", "USD")
    vef_wallet = create_wallet(db, user.id, "Banco Vnz", "VEF")
    transaction = create_transaction(db, user.id, usd_wallet.id, "expense", Decimal("30.00"), "Mercado")
    assert transaction.reference_amount_usd is None  # USD, sin referencia

    updated = update_transaction(
        db, transaction.id, user.id, vef_wallet.id, "expense", Decimal("3650"), "Mercado", None, transaction.occurred_at
    )

    # Mock autouse (_mock_vef_rate en conftest.py): 1 USD = 36.5 VEF.
    assert updated.reference_amount_usd == Decimal("3650") / Decimal("36.5")


def test_update_transaction_rejects_editing_a_transfer_leg(db):
    user = _user(db)
    cash = create_wallet(db, user.id, "Cash", "USD")
    cash.balance = Decimal("100.00")
    bank = create_wallet(db, user.id, "Banco", "USD")
    db.commit()
    execute_transfer(db, user.id, cash.id, bank.id, Decimal("40.00"))
    leg = next(t for t in list_transactions_for_user(db, user.id) if t.wallet_id == cash.id)

    with pytest.raises(TransactionValidationError):
        update_transaction(db, leg.id, user.id, cash.id, "expense", Decimal("50.00"), "Mercado", None, leg.occurred_at)


def test_update_transaction_rejects_non_positive_amount(db):
    user = _user(db)
    wallet = create_wallet(db, user.id, "Cash", "USD")
    transaction = create_transaction(db, user.id, wallet.id, "expense", Decimal("30.00"), "Mercado")

    with pytest.raises(TransactionValidationError):
        update_transaction(db, transaction.id, user.id, wallet.id, "expense", Decimal("0"), "Mercado", None, transaction.occurred_at)


def test_update_transaction_rejects_a_wallet_not_owned_by_the_user(db):
    user_a = _user(db, "a@example.com")
    user_b = _user(db, "b@example.com")
    wallet_a = create_wallet(db, user_a.id, "Cash", "USD")
    wallet_b = create_wallet(db, user_b.id, "Cash", "USD")
    transaction = create_transaction(db, user_a.id, wallet_a.id, "expense", Decimal("30.00"), "Mercado")

    with pytest.raises(TransactionValidationError):
        update_transaction(
            db, transaction.id, user_a.id, wallet_b.id, "expense", Decimal("30.00"), "Mercado", None, transaction.occurred_at
        )


def test_update_transaction_rejects_another_users_transaction(db):
    user_a = _user(db, "a@example.com")
    user_b = _user(db, "b@example.com")
    wallet_a = create_wallet(db, user_a.id, "Cash", "USD")
    transaction = create_transaction(db, user_a.id, wallet_a.id, "expense", Decimal("30.00"), "Mercado")

    with pytest.raises(TransactionValidationError):
        update_transaction(
            db, transaction.id, user_b.id, wallet_a.id, "expense", Decimal("30.00"), "Mercado", None, transaction.occurred_at
        )


# --- backfill_reference_amounts (pedido explícito del usuario, con captura real: en
# Movimientos vio transactions viejas en VEF sin ningún valor de referencia) ---------


def test_backfill_reference_amounts_fills_null_values_for_non_usd_wallets(db):
    user = _user(db)
    wallet = create_wallet(db, user.id, "Banco Vnz", "VEF")
    transaction = create_transaction(db, user.id, wallet.id, "expense", Decimal("3650"), "Mercado")
    # Simula una fila "vieja" (creada antes de que reference_amount_usd existiera).
    transaction.reference_amount_usd = None
    db.commit()

    updated_count = backfill_reference_amounts(db)

    db.refresh(transaction)
    assert updated_count == 1
    # round(...,2): la tasa VEF->USD se guarda en una columna Numeric(24,10) - crear la
    # transaction ya insertó una fila para calcular el fallback, y releerla acá pierde
    # precisión mucho más allá del centavo (invisible en la UI, pero rompe una
    # igualdad exacta de Decimal). Mismo criterio que test_analytics_service.py.
    assert round(transaction.reference_amount_usd, 2) == round(Decimal("3650") / Decimal("36.5"), 2)


def test_backfill_reference_amounts_skips_usd_wallets(db):
    user = _user(db)
    wallet = create_wallet(db, user.id, "Cash", "USD")
    transaction = create_transaction(db, user.id, wallet.id, "expense", Decimal("30.00"), "Mercado")
    transaction.reference_amount_usd = None
    db.commit()

    updated_count = backfill_reference_amounts(db)

    db.refresh(transaction)
    assert updated_count == 0
    assert transaction.reference_amount_usd is None


def test_backfill_reference_amounts_is_idempotent(db):
    user = _user(db)
    wallet = create_wallet(db, user.id, "Banco Vnz", "VEF")
    transaction = create_transaction(db, user.id, wallet.id, "expense", Decimal("3650"), "Mercado")
    transaction.reference_amount_usd = None
    db.commit()

    first_run = backfill_reference_amounts(db)
    second_run = backfill_reference_amounts(db)

    assert first_run == 1
    assert second_run == 0  # ya no queda ninguna fila en NULL


def test_backfill_reference_amounts_uses_each_transactions_own_historical_date(db):
    user = _user(db)
    wallet = create_wallet(db, user.id, "Banco Vnz", "VEF")
    vef = get_currency_by_code(db, "VEF")
    usd = get_currency_by_code(db, "USD")
    old_date = datetime(2026, 6, 1, tzinfo=timezone.utc)
    db.add(ExchangeRate(base_currency_id=vef.id, quote_currency_id=usd.id, rate=Decimal("1") / Decimal("50"), fetched_at=old_date))
    db.commit()
    transaction = create_transaction(
        db, user.id, wallet.id, "expense", Decimal("500"), "Mercado", occurred_at=datetime(2026, 6, 15, tzinfo=timezone.utc)
    )
    transaction.reference_amount_usd = None
    db.commit()

    backfill_reference_amounts(db)

    db.refresh(transaction)
    assert transaction.reference_amount_usd == Decimal("500") / Decimal("50")


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
