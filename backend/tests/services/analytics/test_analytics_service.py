from datetime import datetime, timezone
from decimal import Decimal

from app.models.transactions.transaction_model import Transaction
from app.services.analytics.analytics_service import get_category_breakdown, get_monthly_comparison, get_period_summary
from app.services.auth.auth_service import register_user
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
