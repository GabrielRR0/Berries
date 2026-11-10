from datetime import date, datetime, timezone
from decimal import Decimal

from app.modules.analytics.services.insights import get_insights
from app.modules.analytics.services.period_comparison import get_period_comparison
from app.modules.analytics.services.spending_patterns import get_spending_patterns
from app.modules.analytics.services.timeline import get_timeline
from app.modules.analytics.services.top_transactions import get_top_transactions
from app.modules.analytics.services.wallet_breakdown import get_wallet_breakdown
from app.modules.auth import register_user
from app.modules.transactions import create_transaction
from app.modules.wallets import create_wallet, execute_transfer

TODAY = date(2026, 11, 9)  # lunes


def _user(db, email="ana@example.com"):
    user = register_user(db, email, "clave12345", "Ana")
    # Registrado "hace años": estos tests usan datos de meses pasados, y el análisis solo
    # compara contra períodos posteriores al registro (ver registration_day).
    user.created_at = datetime(2020, 1, 1, tzinfo=timezone.utc)
    db.commit()
    return user


def _dt(year, month, day):
    return datetime(year, month, day, 12, tzinfo=timezone.utc)


def _spend(db, user, wallet, amount, category, when, kind="expense"):
    return create_transaction(db, user.id, wallet.id, kind, Decimal(amount), category, occurred_at=when)


# --- timeline ------------------------------------------------------------------------


def test_timeline_by_day_fills_empty_days_with_zeros(db):
    user = _user(db)
    wallet = create_wallet(db, user.id, "Cash", "USD")
    _spend(db, user, wallet, "40", "Mercado", _dt(2026, 11, 2))
    _spend(db, user, wallet, "1000", "Salario", _dt(2026, 11, 3), kind="income")

    result = get_timeline(db, user.id, "day", date(2026, 11, 1), date(2026, 11, 4))

    assert [bucket.start for bucket in result.buckets] == [date(2026, 11, d) for d in (1, 2, 3, 4)]
    assert [bucket.total_expense for bucket in result.buckets] == [0, 40, 0, 0]
    assert [bucket.total_income for bucket in result.buckets] == [0, 0, 1000, 0]
    assert [bucket.count for bucket in result.buckets] == [0, 1, 1, 0]
    assert result.buckets[2].net == Decimal("1000")


def test_timeline_by_week_groups_monday_to_sunday_and_measures_the_first_week_whole(db):
    user = _user(db)
    wallet = create_wallet(db, user.id, "Cash", "USD")
    _spend(db, user, wallet, "10", "Mercado", _dt(2026, 11, 2))  # lunes
    _spend(db, user, wallet, "20", "Mercado", _dt(2026, 11, 8))  # domingo, misma semana
    _spend(db, user, wallet, "30", "Mercado", _dt(2026, 11, 9))  # lunes siguiente

    result = get_timeline(db, user.id, "week", date(2026, 11, 5), date(2026, 11, 9))

    assert [bucket.start for bucket in result.buckets] == [date(2026, 11, 2), date(2026, 11, 9)]
    assert [bucket.total_expense for bucket in result.buckets] == [30, 30]


def test_timeline_by_month_and_wallet_filter(db):
    user = _user(db)
    cash = create_wallet(db, user.id, "Cash", "USD")
    bank = create_wallet(db, user.id, "Bank", "USD")
    _spend(db, user, cash, "10", "Mercado", _dt(2026, 10, 5))
    _spend(db, user, bank, "90", "Mercado", _dt(2026, 10, 6))
    _spend(db, user, bank, "5", "Mercado", _dt(2026, 11, 1))

    everything = get_timeline(db, user.id, "month", date(2026, 10, 1), date(2026, 11, 30))
    only_cash = get_timeline(db, user.id, "month", date(2026, 10, 1), date(2026, 11, 30), cash.id)

    assert [bucket.total_expense for bucket in everything.buckets] == [100, 5]
    assert [bucket.total_expense for bucket in only_cash.buckets] == [10, 0]


def test_timeline_excludes_transfers_between_own_wallets(db):
    user = _user(db)
    cash = create_wallet(db, user.id, "Cash", "USD")
    bank = create_wallet(db, user.id, "Bank", "USD")
    _spend(db, user, cash, "500", "Salario", _dt(2026, 11, 1), kind="income")
    execute_transfer(db, user.id, cash.id, bank.id, Decimal("200"))

    result = get_timeline(db, user.id, "month", date(2026, 11, 1), date(2026, 11, 30))

    assert result.buckets[0].total_expense == Decimal("0")
    assert result.buckets[0].total_income == Decimal("500")


# --- comparación ---------------------------------------------------------------------


def test_comparison_uses_the_same_elapsed_days_of_the_previous_month(db):
    user = _user(db)
    wallet = create_wallet(db, user.id, "Cash", "USD")
    _spend(db, user, wallet, "100", "Restaurantes", _dt(2026, 11, 5))
    _spend(db, user, wallet, "50", "Restaurantes", _dt(2026, 10, 5))
    _spend(db, user, wallet, "999", "Restaurantes", _dt(2026, 10, 20))  # fuera del tramo 1..9
    _spend(db, user, wallet, "30", "Transporte", _dt(2026, 10, 2))

    result = get_period_comparison(db, user.id, "2026-11", "previous", TODAY)

    assert result.elapsed_days == 9
    assert result.days_in_month == 30
    assert result.current_total == Decimal("100")
    assert result.previous_total == Decimal("80")
    restaurantes = next(item for item in result.categories if item.category == "Restaurantes")
    assert restaurantes.delta_percent == 100.0
    transporte = next(item for item in result.categories if item.category == "Transporte")
    assert transporte.current == 0 and transporte.delta_percent == -100.0


def test_comparison_without_base_has_no_percentage(db):
    user = _user(db)
    wallet = create_wallet(db, user.id, "Cash", "USD")
    _spend(db, user, wallet, "100", "Nueva", _dt(2026, 11, 5))

    result = get_period_comparison(db, user.id, "2026-11", "previous", TODAY)

    assert result.delta_percent is None
    assert result.categories[0].delta_percent is None


def test_comparison_against_average_uses_three_prior_months(db):
    user = _user(db)
    wallet = create_wallet(db, user.id, "Cash", "USD")
    _spend(db, user, wallet, "30", "Mercado", _dt(2026, 10, 3))
    _spend(db, user, wallet, "60", "Mercado", _dt(2026, 9, 3))
    _spend(db, user, wallet, "90", "Mercado", _dt(2026, 8, 3))
    _spend(db, user, wallet, "120", "Mercado", _dt(2026, 11, 3))

    result = get_period_comparison(db, user.id, "2026-11", "average", TODAY)

    assert result.categories[0].previous == Decimal("60")
    assert result.categories[0].delta_percent == 100.0


def test_comparison_against_year_ago(db):
    user = _user(db)
    wallet = create_wallet(db, user.id, "Cash", "USD")
    _spend(db, user, wallet, "200", "Mercado", _dt(2025, 11, 4))
    _spend(db, user, wallet, "100", "Mercado", _dt(2026, 11, 4))

    result = get_period_comparison(db, user.id, "2026-11", "year_ago", TODAY)

    assert result.previous_total == Decimal("200")
    assert result.delta_percent == -50.0


# --- patrones --------------------------------------------------------------------------


def test_patterns_cover_whole_weeks_up_to_today_and_find_the_busiest_day(db):
    user = _user(db)
    wallet = create_wallet(db, user.id, "Cash", "USD")
    _spend(db, user, wallet, "100", "Mercado", _dt(2026, 11, 7))  # sábado
    _spend(db, user, wallet, "20", "Mercado", _dt(2026, 11, 4))  # miércoles
    _spend(db, user, wallet, "5", "Mercado", _dt(2026, 11, 10))  # futuro: no entra

    result = get_spending_patterns(db, user.id, weeks=2, today=TODAY)

    # Hoy es lunes 9: la semana en curso solo tiene ese día; la anterior arranca el lunes 2.
    assert result.first_day == date(2026, 11, 2)
    assert result.last_day == TODAY
    assert len(result.heat) == 8
    assert result.busiest_day.day == date(2026, 11, 7)
    assert result.busiest_weekday == 5
    assert result.weekend_share == 100 / 120
    assert result.daily_average == Decimal("120") / 8


def test_patterns_without_spending_are_all_zero(db):
    user = _user(db)
    create_wallet(db, user.id, "Cash", "USD")

    result = get_spending_patterns(db, user.id, weeks=2, today=TODAY)

    assert result.weekend_share == 0.0
    assert result.busiest_day is None and result.busiest_weekday is None
    assert result.daily_average == 0


# --- billeteras y mayores gastos --------------------------------------------------------


def test_wallet_breakdown_orders_by_total_and_computes_percentages(db):
    user = _user(db)
    cash = create_wallet(db, user.id, "Cash", "USD")
    bank = create_wallet(db, user.id, "Bank", "USD")
    create_wallet(db, user.id, "Vacía", "USD")
    _spend(db, user, cash, "25", "Mercado", _dt(2026, 11, 2))
    _spend(db, user, bank, "50", "Mercado", _dt(2026, 11, 3))
    _spend(db, user, bank, "25", "Mercado", _dt(2026, 11, 4))

    result = get_wallet_breakdown(db, user.id, "expense", "2026-11")

    assert [item.name for item in result] == ["Bank", "Cash"]
    assert [item.percentage for item in result] == [75.0, 25.0]
    assert [item.count for item in result] == [2, 1]


def test_top_transactions_returns_largest_first_and_respects_limit(db):
    user = _user(db)
    wallet = create_wallet(db, user.id, "Cash", "USD")
    for amount in ("10", "90", "40"):
        _spend(db, user, wallet, amount, "Mercado", _dt(2026, 11, 2))
    _spend(db, user, wallet, "500", "Mercado", _dt(2026, 10, 2))  # otro mes

    result = get_top_transactions(db, user.id, "expense", "2026-11", limit=2)

    assert [item.amount for item in result] == [Decimal("90"), Decimal("40")]
    assert result[0].wallet_name == "Cash"


# --- recomendaciones --------------------------------------------------------------------


def test_insights_for_a_new_user_say_there_is_not_enough_history(db):
    user = _user(db)
    wallet = create_wallet(db, user.id, "Cash", "USD")
    _spend(db, user, wallet, "40", "Mercado", _dt(2026, 11, 2))

    result = get_insights(db, user.id, "2026-11", TODAY)

    assert [item.code for item in result] == ["not_enough_history"]


def test_insights_flag_overspending_against_the_three_month_average(db):
    user = _user(db)
    wallet = create_wallet(db, user.id, "Cash", "USD")
    for month in (8, 9, 10):
        for day in (3, 8, 13, 18, 23):
            _spend(db, user, wallet, "60", "Mercado", _dt(2026, month, day))  # 300 al mes
    for day in (2, 4, 6, 8):
        _spend(db, user, wallet, "100", "Restaurantes", _dt(2026, 11, day))  # 400 en 9 días

    result = get_insights(db, user.id, "2026-11", TODAY)

    overspend = next(item for item in result if item.code == "projected_overspend")
    assert overspend.level == "alert"
    assert overspend.reference_amount == Decimal("300")


# --- nada se compara con fechas anteriores al registro -------------------------------


def _registered_on(db, user, day):
    user.created_at = datetime(day.year, day.month, day.day, tzinfo=timezone.utc)
    db.commit()


def test_comparison_ignores_a_previous_month_that_ended_before_registration(db):
    user = _user(db)
    wallet = create_wallet(db, user.id, "Cash", "USD")
    _spend(db, user, wallet, "100", "Mercado", _dt(2026, 11, 5))
    _spend(db, user, wallet, "50", "Mercado", _dt(2026, 10, 5))  # dato "viejo", antes del registro
    _registered_on(db, user, date(2026, 11, 1))

    result = get_period_comparison(db, user.id, "2026-11", "previous", TODAY)

    assert result.previous_total == Decimal("0")
    assert result.delta_percent is None


def test_comparison_year_ago_ignores_a_window_before_registration(db):
    user = _user(db)
    wallet = create_wallet(db, user.id, "Cash", "USD")
    _spend(db, user, wallet, "100", "Mercado", _dt(2026, 11, 5))
    _spend(db, user, wallet, "70", "Mercado", _dt(2025, 11, 5))
    _registered_on(db, user, date(2026, 9, 1))

    result = get_period_comparison(db, user.id, "2026-11", "year_ago", TODAY)

    assert result.previous_total == Decimal("0")


def test_comparison_average_only_uses_months_since_registration(db):
    user = _user(db)
    wallet = create_wallet(db, user.id, "Cash", "USD")
    _spend(db, user, wallet, "100", "Mercado", _dt(2026, 11, 5))
    _spend(db, user, wallet, "60", "Mercado", _dt(2026, 10, 5))
    _spend(db, user, wallet, "900", "Mercado", _dt(2026, 8, 5))  # antes del registro: no cuenta
    _registered_on(db, user, date(2026, 10, 1))

    result = get_period_comparison(db, user.id, "2026-11", "average", TODAY)

    # Solo octubre cuenta, y se divide entre 1 mes (no entre 3).
    assert result.previous_total == Decimal("60")


def test_transactions_dated_before_registration_are_left_out_of_every_analysis(db):
    user = _user(db)
    wallet = create_wallet(db, user.id, "Cash", "USD")
    _spend(db, user, wallet, "500", "Viejo", _dt(2026, 10, 20))
    _spend(db, user, wallet, "40", "Mercado", _dt(2026, 11, 5))
    _registered_on(db, user, date(2026, 11, 1))

    from app.modules.analytics.services.category_breakdown import get_category_monthly_trend
    from app.modules.analytics.services.period_summary import get_period_summary

    assert get_period_summary(db, user.id, "2026-10").total_expense == Decimal("0")
    assert get_period_summary(db, user.id, "2026-11").total_expense == Decimal("40")
    trend = get_category_monthly_trend(db, user.id, "expense", 6)
    assert trend.months == ["2026-11"]
    assert [item.category for item in trend.categories] == ["Mercado"]


def test_spending_patterns_do_not_count_days_before_registration(db):
    user = _user(db)
    wallet = create_wallet(db, user.id, "Cash", "USD")
    _spend(db, user, wallet, "90", "Mercado", _dt(2026, 11, 9))
    _registered_on(db, user, date(2026, 11, 8))

    result = get_spending_patterns(db, user.id, 2, TODAY)

    # Solo cuentan el 8 y el 9 de noviembre: 90 / 2 dias.
    assert result.daily_average == Decimal("45")
