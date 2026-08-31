from datetime import date

from app.services.goals.goal_entity_parser import parse_goal_entities

_TODAY = date(2026, 8, 28)


def test_parses_monthly_amount_and_relative_months():
    result = parse_goal_entities("quiero comprar un TV de aquí a tres meses, debo reunir 80 dólares al mes", "USD", _TODAY)

    assert result.amount == 80.0
    assert result.amount_is_monthly is True
    assert result.currency == "USD"
    assert result.target_date == date(2026, 11, 28)
    assert result.title == "un TV"


def test_parses_monthly_amount_with_en_n_meses_phrasing():
    result = parse_goal_entities("quiero comprar una MacBook en 4 meses, debo reunir 300 dólares cada mes", "USD", _TODAY)

    assert result.amount == 300.0
    assert result.amount_is_monthly is True
    assert result.target_date == date(2026, 12, 28)


def test_amount_without_monthly_marker_is_treated_as_total():
    result = parse_goal_entities("quiero ahorrar 1000 para un viaje en 2 meses", "USD", _TODAY)

    assert result.amount == 1000.0
    assert result.amount_is_monthly is False
    assert result.target_date == date(2026, 10, 28)


def test_does_not_confuse_the_duration_number_with_the_amount():
    # "3" es la duracion (meses), no el monto - regresion directa del bug que motivo
    # esta heuristica (ver comentario en _extract_amount_and_monthly_flag).
    result = parse_goal_entities("en 3 meses necesito 500", "USD", _TODAY)

    assert result.amount == 500.0


def test_parses_days_and_weeks():
    assert parse_goal_entities("lo necesito en 10 días, son 50 dólares", "USD", _TODAY).target_date == date(2026, 9, 7)
    assert parse_goal_entities("en 2 semanas junto 20 dólares", "USD", _TODAY).target_date == date(2026, 9, 11)


def test_falls_back_to_default_currency_when_none_mentioned():
    result = parse_goal_entities("quiero comprar unos audífonos en 2 meses, 60", "EUR", _TODAY)

    assert result.currency == "EUR"


def test_returns_none_amount_and_date_when_nothing_recognizable():
    result = parse_goal_entities("hola cómo estás", "USD", _TODAY)

    assert result.amount is None
    assert result.target_date is None
