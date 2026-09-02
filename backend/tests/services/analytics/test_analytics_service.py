from datetime import datetime, timezone
from decimal import Decimal

from app.models.currency.exchange_rate_model import ExchangeRate
from app.models.transactions.transaction_model import Transaction
from app.services.analytics.analytics_service import (
    get_category_breakdown,
    get_category_monthly_trend,
    get_monthly_comparison,
    get_period_summary,
)
from app.services.auth.auth_service import register_user
from app.services.currency.currency_lookup import get_currency_by_code
from app.services.transactions.transaction_service import create_transaction
from app.services.wallets.transfer_service import execute_transfer
from app.services.wallets.wallet_service import create_wallet

# El fixture `db` vive en tests/conftest.py y se inyecta automáticamente.


def _user(db, email="ana@example.com"):
    return register_user(db, email, "clave12345", "Ana")


def _wallet(db, user_id, name="Cash", currency="USD"):
    return create_wallet(db, user_id, name, currency)


def _dt(year, month, day=15):
    return datetime(year, month, day, tzinfo=timezone.utc)


def _shift(year, month, delta):
    """Reimplementación independiente de la aritmética de meses, para no acoplar el
    test a la función privada del service que está bajo prueba."""
    total = year * 12 + (month - 1) + delta
    y, m = divmod(total, 12)
    return y, m + 1


# --- get_period_summary ------------------------------------------------------------


def test_period_summary_computes_totals_for_month_with_mixed_transactions(db):
    user = _user(db)
    wallet = _wallet(db, user.id)
    create_transaction(db, user.id, wallet.id, "income", Decimal("1000.00"), "Salario", occurred_at=_dt(2024, 3, 1))
    create_transaction(db, user.id, wallet.id, "expense", Decimal("400.00"), "Renta", occurred_at=_dt(2024, 3, 10))
    create_transaction(db, user.id, wallet.id, "expense", Decimal("100.00"), "Comida", occurred_at=_dt(2024, 3, 20))
    # Fuera del mes bajo prueba — no debe contaminar los totales de marzo.
    create_transaction(db, user.id, wallet.id, "income", Decimal("50.00"), "Extra", occurred_at=_dt(2024, 2, 28))

    summary = get_period_summary(db, user.id, "2024-03")

    assert summary.period == "2024-03"
    assert summary.total_income == Decimal("1000.00")
    assert summary.total_expense == Decimal("500.00")
    assert summary.net_savings == Decimal("500.00")


def test_period_summary_month_with_zero_transactions_is_all_zeros_and_does_not_crash(db):
    user = _user(db)
    _wallet(db, user.id)

    summary = get_period_summary(db, user.id, "2024-04")

    assert summary.total_income == Decimal("0")
    assert summary.total_expense == Decimal("0")
    assert summary.net_savings == Decimal("0")
    assert summary.previous_period_net_savings == Decimal("0")


def test_period_summary_previous_period_net_savings_reflects_prior_month(db):
    user = _user(db)
    wallet = _wallet(db, user.id)
    # Mayo: net = 800 - 300 = 500
    create_transaction(db, user.id, wallet.id, "income", Decimal("800.00"), "Salario", occurred_at=_dt(2024, 5, 1))
    create_transaction(db, user.id, wallet.id, "expense", Decimal("300.00"), "Renta", occurred_at=_dt(2024, 5, 10))
    # Junio: net = 200 - 50 = 150
    create_transaction(db, user.id, wallet.id, "income", Decimal("200.00"), "Salario", occurred_at=_dt(2024, 6, 1))
    create_transaction(db, user.id, wallet.id, "expense", Decimal("50.00"), "Comida", occurred_at=_dt(2024, 6, 10))

    summary = get_period_summary(db, user.id, "2024-06")

    assert summary.net_savings == Decimal("150.00")
    assert summary.previous_period_net_savings == Decimal("500.00")


def test_period_summary_defaults_to_current_calendar_month(db):
    user = _user(db)
    wallet = _wallet(db, user.id)
    now = datetime.now(timezone.utc)
    create_transaction(db, user.id, wallet.id, "income", Decimal("77.00"), "Salario", occurred_at=now)

    summary = get_period_summary(db, user.id, None)

    assert summary.period == f"{now.year:04d}-{now.month:02d}"
    assert summary.total_income == Decimal("77.00")


def test_period_summary_excludes_transfer_legs_but_includes_transfer_fee(db):
    # Regresion: antes de excluir source="transfer", mover plata entre wallets propias
    # inflaba ingreso Y gasto por igual - una transferencia no es ni ingreso ni gasto
    # real (ver transfer_service.py). La comision SI cuenta (source="manual").
    user = _user(db)
    cash = _wallet(db, user.id, "Cash")
    bank = _wallet(db, user.id, "Banco")
    create_transaction(db, user.id, cash.id, "income", Decimal("1000.00"), "Salario")

    execute_transfer(db, user.id, cash.id, bank.id, Decimal("680.00"), fee=Decimal("30.00"))

    summary = get_period_summary(db, user.id, None)

    assert summary.total_income == Decimal("1000.00")  # la pata "income" de la transferencia queda afuera
    assert summary.total_expense == Decimal("30.00")  # solo la comision cuenta como gasto real


def test_period_summary_does_not_leak_other_users_transactions(db):
    user_a = _user(db, "a@example.com")
    user_b = _user(db, "b@example.com")
    wallet_a = _wallet(db, user_a.id)
    wallet_b = _wallet(db, user_b.id, "Banco")
    create_transaction(db, user_a.id, wallet_a.id, "income", Decimal("100.00"), "Salario", occurred_at=_dt(2024, 3, 1))
    create_transaction(db, user_b.id, wallet_b.id, "income", Decimal("9999.00"), "Salario", occurred_at=_dt(2024, 3, 1))

    summary = get_period_summary(db, user_a.id, "2024-03")

    assert summary.total_income == Decimal("100.00")


# --- get_category_breakdown --------------------------------------------------------


def test_category_breakdown_percentages_sum_to_100_and_sorted_descending(db):
    user = _user(db)
    wallet = _wallet(db, user.id)
    create_transaction(db, user.id, wallet.id, "expense", Decimal("100.00"), "Comida", occurred_at=_dt(2024, 7, 1))
    create_transaction(db, user.id, wallet.id, "expense", Decimal("50.00"), "Transporte", occurred_at=_dt(2024, 7, 2))
    create_transaction(db, user.id, wallet.id, "expense", Decimal("25.00"), "Comida", occurred_at=_dt(2024, 7, 3))
    # Otro type y otro mes — no debe aparecer en el desglose de expense de julio.
    create_transaction(db, user.id, wallet.id, "income", Decimal("500.00"), "Salario", occurred_at=_dt(2024, 7, 4))
    create_transaction(db, user.id, wallet.id, "expense", Decimal("999.00"), "Comida", occurred_at=_dt(2024, 8, 1))

    items = get_category_breakdown(db, user.id, "expense", "2024-07")

    assert [item.category for item in items] == ["Comida", "Transporte"]
    assert items[0].total == Decimal("125.00")
    assert items[1].total == Decimal("50.00")
    assert abs(sum(item.percentage for item in items) - 100.0) < 0.01


def test_category_breakdown_with_no_transactions_of_that_type_returns_empty_without_error(db):
    user = _user(db)
    wallet = _wallet(db, user.id)
    create_transaction(db, user.id, wallet.id, "expense", Decimal("100.00"), "Comida", occurred_at=_dt(2024, 7, 1))

    items = get_category_breakdown(db, user.id, "income", "2024-07")

    assert items == []


def test_category_breakdown_avoids_division_by_zero_when_grand_total_is_zero(db):
    """Caso borde: la API real nunca crea transacciones de monto 0 (el schema exige
    amount > 0), pero la agregación no debe reventar con ZeroDivisionError si alguna
    vez se topa con una — se inserta directo por el modelo para forzar el caso."""
    user = _user(db)
    wallet = _wallet(db, user.id)
    db.add(
        Transaction(
            user_id=user.id,
            wallet_id=wallet.id,
            type="expense",
            amount=Decimal("0"),
            category="Comida",
            occurred_at=_dt(2024, 9, 1),
        )
    )
    db.add(
        Transaction(
            user_id=user.id,
            wallet_id=wallet.id,
            type="expense",
            amount=Decimal("0"),
            category="Transporte",
            occurred_at=_dt(2024, 9, 2),
        )
    )
    db.commit()

    items = get_category_breakdown(db, user.id, "expense", "2024-09")

    assert len(items) == 2
    assert all(item.percentage == 0.0 for item in items)


def test_category_breakdown_does_not_leak_other_users_transactions(db):
    user_a = _user(db, "a@example.com")
    user_b = _user(db, "b@example.com")
    wallet_a = _wallet(db, user_a.id)
    wallet_b = _wallet(db, user_b.id, "Banco")
    create_transaction(db, user_a.id, wallet_a.id, "expense", Decimal("10.00"), "Comida", occurred_at=_dt(2024, 7, 1))
    create_transaction(db, user_b.id, wallet_b.id, "expense", Decimal("999.00"), "Comida", occurred_at=_dt(2024, 7, 1))

    items = get_category_breakdown(db, user_a.id, "expense", "2024-07")

    assert len(items) == 1
    assert items[0].total == Decimal("10.00")


# --- get_monthly_comparison ---------------------------------------------------------


def test_monthly_comparison_returns_exact_count_oldest_to_newest_ending_in_current_month(db):
    user = _user(db)
    _wallet(db, user.id)

    items = get_monthly_comparison(db, user.id, 6)

    assert len(items) == 6
    now = datetime.now(timezone.utc)
    expected_months = []
    year, month = now.year, now.month
    for offset in range(5, -1, -1):
        y, m = _shift(now.year, now.month, -offset)
        expected_months.append(f"{y:04d}-{m:02d}")
    assert [item.month for item in items] == expected_months
    assert items[-1].month == f"{now.year:04d}-{now.month:02d}"


def test_monthly_comparison_includes_middle_gap_month_with_zero_totals(db):
    user = _user(db)
    wallet = _wallet(db, user.id)
    now = datetime.now(timezone.utc)
    y_minus2, m_minus2 = _shift(now.year, now.month, -2)
    y_minus1, m_minus1 = _shift(now.year, now.month, -1)
    # -2 y el mes actual tienen datos; -1 (el del medio) queda deliberadamente vacío.
    create_transaction(
        db, user.id, wallet.id, "income", Decimal("300.00"), "Salario", occurred_at=_dt(y_minus2, m_minus2, 5)
    )
    create_transaction(db, user.id, wallet.id, "expense", Decimal("60.00"), "Comida", occurred_at=now)

    items = get_monthly_comparison(db, user.id, 3)

    assert len(items) == 3
    middle = items[1]
    assert middle.month == f"{y_minus1:04d}-{m_minus1:02d}"
    assert middle.total_income == Decimal("0")
    assert middle.total_expense == Decimal("0")
    assert middle.net == Decimal("0")
    assert items[0].total_income == Decimal("300.00")
    assert items[-1].total_expense == Decimal("60.00")


def test_monthly_comparison_does_not_leak_other_users_transactions(db):
    user_a = _user(db, "a@example.com")
    user_b = _user(db, "b@example.com")
    wallet_a = _wallet(db, user_a.id)
    wallet_b = _wallet(db, user_b.id, "Banco")
    now = datetime.now(timezone.utc)
    create_transaction(db, user_a.id, wallet_a.id, "income", Decimal("10.00"), "Salario", occurred_at=now)
    create_transaction(db, user_b.id, wallet_b.id, "income", Decimal("9999.00"), "Salario", occurred_at=now)

    items = get_monthly_comparison(db, user_a.id, 1)

    assert len(items) == 1
    assert items[0].total_income == Decimal("10.00")


# --- get_category_monthly_trend -----------------------------------------------------


def test_category_monthly_trend_tracks_one_category_across_months(db):
    user = _user(db)
    wallet = _wallet(db, user.id)
    now = datetime.now(timezone.utc)
    y_minus1, m_minus1 = _shift(now.year, now.month, -1)
    create_transaction(db, user.id, wallet.id, "expense", Decimal("80.00"), "Mercado", occurred_at=_dt(y_minus1, m_minus1))
    create_transaction(db, user.id, wallet.id, "expense", Decimal("120.00"), "Mercado", occurred_at=now)

    trend = get_category_monthly_trend(db, user.id, "expense", months=2)

    assert len(trend.months) == 2
    assert trend.months[-1] == f"{now.year:04d}-{now.month:02d}"
    mercado = next(item for item in trend.categories if item.category == "Mercado")
    assert mercado.monthly_totals == [Decimal("80.00"), Decimal("120.00")]


def test_category_monthly_trend_includes_zero_for_month_without_that_category(db):
    user = _user(db)
    wallet = _wallet(db, user.id)
    now = datetime.now(timezone.utc)
    create_transaction(db, user.id, wallet.id, "expense", Decimal("50.00"), "Gasolina", occurred_at=now)

    trend = get_category_monthly_trend(db, user.id, "expense", months=3)

    gasolina = next(item for item in trend.categories if item.category == "Gasolina")
    assert gasolina.monthly_totals == [Decimal("0"), Decimal("0"), Decimal("50.00")]


def test_category_monthly_trend_caps_at_top_n_and_groups_the_rest_as_otros(db):
    user = _user(db)
    wallet = _wallet(db, user.id)
    now = datetime.now(timezone.utc)
    # 6 categorías con montos claramente distintos, top_n default = 5.
    amounts = [("Renta", "600"), ("Mercado", "300"), ("Gasolina", "150"), ("Ocio", "90"), ("Salud", "60"), ("Ropa", "20")]
    for category, amount in amounts:
        create_transaction(db, user.id, wallet.id, "expense", Decimal(amount), category, occurred_at=now)

    trend = get_category_monthly_trend(db, user.id, "expense", months=1)

    categories = [item.category for item in trend.categories]
    assert categories == ["Renta", "Mercado", "Gasolina", "Ocio", "Salud", "Otros"]
    otros = trend.categories[-1]
    assert otros.monthly_totals == [Decimal("20.00")]


def test_category_monthly_trend_without_enough_categories_has_no_otros_entry(db):
    user = _user(db)
    wallet = _wallet(db, user.id)
    now = datetime.now(timezone.utc)
    create_transaction(db, user.id, wallet.id, "expense", Decimal("40.00"), "Comida", occurred_at=now)

    trend = get_category_monthly_trend(db, user.id, "expense", months=1)

    assert [item.category for item in trend.categories] == ["Comida"]


def test_category_monthly_trend_does_not_leak_other_users_transactions(db):
    user_a = _user(db, "a@example.com")
    user_b = _user(db, "b@example.com")
    wallet_a = _wallet(db, user_a.id)
    wallet_b = _wallet(db, user_b.id, "Banco")
    now = datetime.now(timezone.utc)
    create_transaction(db, user_a.id, wallet_a.id, "expense", Decimal("10.00"), "Comida", occurred_at=now)
    create_transaction(db, user_b.id, wallet_b.id, "expense", Decimal("999.00"), "Comida", occurred_at=now)

    trend = get_category_monthly_trend(db, user_a.id, "expense", months=1)

    assert len(trend.categories) == 1
    assert trend.categories[0].monthly_totals == [Decimal("10.00")]


# --- conversión de moneda entre wallets (bug real reportado por el usuario, con
# captura: un gasto de 5.560 VEF en una wallet en bolívares se mostraba como
# "$5,560.00", como si fuera USD - Transaction no guarda su propia moneda, y antes se
# sumaba el monto crudo de TODAS las wallets sin importar la suya) ------------------


def test_period_summary_converts_non_default_currency_wallet_before_summing(db):
    user = _user(db)  # default_currency queda en USD (default de register_user)
    vef_wallet = _wallet(db, user.id, "Banco VES", "VEF")
    # Fallback documentado: 1 USD = 36.5 VEF (ver test_currency_service.py) -> 3650 VEF
    # equivalen a exactamente $100.
    create_transaction(db, user.id, vef_wallet.id, "expense", Decimal("3650"), "Comida", occurred_at=_dt(2024, 7, 1))

    summary = get_period_summary(db, user.id, "2024-07")

    assert summary.total_expense == Decimal("100")


def test_period_summary_does_not_blend_amounts_across_currencies(db):
    """El bug tal cual se reportó: una wallet en USD y otra en VEF, cada una con un
    gasto - el total no puede ser la suma cruda de los dos numeros (150), tiene que
    convertir primero el de VEF."""
    user = _user(db)
    usd_wallet = _wallet(db, user.id, "Efectivo", "USD")
    vef_wallet = _wallet(db, user.id, "Banco VES", "VEF")
    create_transaction(db, user.id, usd_wallet.id, "expense", Decimal("50"), "Renta", occurred_at=_dt(2024, 7, 1))
    create_transaction(db, user.id, vef_wallet.id, "expense", Decimal("3650"), "Comida", occurred_at=_dt(2024, 7, 2))

    summary = get_period_summary(db, user.id, "2024-07")

    assert summary.total_expense == Decimal("150")  # 50 USD + (3650 VEF -> 100 USD)


def test_category_breakdown_converts_non_default_currency_wallet(db):
    user = _user(db)
    vef_wallet = _wallet(db, user.id, "Banco VES", "VEF")
    create_transaction(db, user.id, vef_wallet.id, "expense", Decimal("3650"), "Comida", occurred_at=_dt(2024, 7, 1))

    items = get_category_breakdown(db, user.id, "expense", "2024-07")

    assert items[0].total == Decimal("100")


def test_monthly_comparison_converts_non_default_currency_wallet(db):
    user = _user(db)
    vef_wallet = _wallet(db, user.id, "Banco VES", "VEF")
    now = datetime.now(timezone.utc)
    create_transaction(db, user.id, vef_wallet.id, "income", Decimal("3650"), "Salario", occurred_at=now)

    items = get_monthly_comparison(db, user.id, 1)

    assert items[0].total_income == Decimal("100")


def test_category_monthly_trend_converts_non_default_currency_wallet(db):
    user = _user(db)
    vef_wallet = _wallet(db, user.id, "Banco VES", "VEF")
    now = datetime.now(timezone.utc)
    create_transaction(db, user.id, vef_wallet.id, "expense", Decimal("3650"), "Comida", occurred_at=now)

    trend = get_category_monthly_trend(db, user.id, "expense", months=1)

    assert trend.categories[0].monthly_totals == [Decimal("100")]


def test_period_summary_uses_the_historical_rate_of_each_transactions_own_date(db):
    """Segunda vuelta del mismo bug reportado por el usuario: un gasto viejo en una
    moneda con inflación fuerte (VEF) no debe reconvertirse con la tasa de HOY - eso le
    reescribiria el valor historico cada vez que la tasa se mueve. Se simulan dos tasas
    VEF/USD distintas en dos fechas distintas (1 USD = 50 VEF hace meses, 1 USD = 200
    VEF mas reciente) y un gasto fechado en el periodo VIEJO."""
    user = _user(db)
    vef_wallet = _wallet(db, user.id, "Banco VES", "VEF")
    usd = get_currency_by_code(db, "USD")
    vef = get_currency_by_code(db, "VEF")
    db.add(
        ExchangeRate(
            base_currency_id=vef.id,
            quote_currency_id=usd.id,
            rate=Decimal("1") / Decimal("50"),
            fetched_at=datetime(2024, 6, 1, tzinfo=timezone.utc),
        )
    )
    db.add(
        ExchangeRate(
            base_currency_id=vef.id,
            quote_currency_id=usd.id,
            rate=Decimal("1") / Decimal("200"),
            fetched_at=datetime(2024, 8, 1, tzinfo=timezone.utc),
        )
    )
    db.commit()
    # 500 VEF, fechado en julio (entre las dos tasas, mas cerca de la vieja) - con la
    # tasa vieja (1 USD=50 VEF) son $10; con la nueva (1 USD=200 VEF) serian $2.50.
    create_transaction(
        db, user.id, vef_wallet.id, "expense", Decimal("500"), "Comida", occurred_at=_dt(2024, 7, 15)
    )

    summary = get_period_summary(db, user.id, "2024-07")

    assert summary.total_expense == Decimal("10")


def test_period_summary_uses_the_users_own_default_currency_as_target(db):
    """Si el usuario elige VEF como moneda por defecto (no todos son USD-first), la
    conversion tiene que apuntar ahi, no a USD siempre."""
    user = register_user(db, "caracas@example.com", "clave12345", "Caro", default_currency="VEF")
    usd_wallet = _wallet(db, user.id, "Efectivo", "USD")
    create_transaction(db, user.id, usd_wallet.id, "expense", Decimal("100"), "Comida", occurred_at=_dt(2024, 7, 1))

    summary = get_period_summary(db, user.id, "2024-07")

    assert summary.total_expense == Decimal("3650")  # 100 USD -> VEF al fallback 36.5
