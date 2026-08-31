from app.services.transactions.drafts.entity_parser import parse_transaction_entities


def test_parses_amount_currency_and_category_from_expense_sentence():
    result = parse_transaction_entities("Gasté 15 USDT en el gym")

    assert result.amount == 15.0
    assert result.currency == "USDT"
    assert result.category == "Gym"
    assert result.description == "Gasté 15 USDT en el gym"


def test_parses_income_sentence():
    result = parse_transaction_entities("Cobré mi sueldo de 500 USD")

    assert result.amount == 500.0
    assert result.currency == "USD"
    assert result.category == "Salario"


def test_falls_back_to_default_currency_when_no_currency_keyword_present():
    result = parse_transaction_entities("Pagué 50 por el almuerzo", default_currency="USD")

    assert result.amount == 50.0
    assert result.currency == "USD"
    assert result.category == "Mercado"


def test_falls_back_to_given_default_currency():
    result = parse_transaction_entities("Pagué 50 por el almuerzo", default_currency="VEF")

    assert result.currency == "VEF"


def test_handles_no_amount_found():
    result = parse_transaction_entities("hola como estas")

    assert result.amount is None
    assert result.category is None
    assert result.currency == "USD"


def test_handles_european_style_thousands_and_decimal_separators():
    result = parse_transaction_entities("Pagué 1.234,56 bs en el mercado")

    assert result.amount == 1234.56
    assert result.currency == "VEF"
    assert result.category == "Mercado"


def test_handles_us_style_thousands_and_decimal_separators():
    result = parse_transaction_entities("Pagué 1,234.56 dólares en servicios de luz")

    assert result.amount == 1234.56
    assert result.currency == "USD"
    assert result.category == "Servicios"


def test_infers_gasolina_category_from_combustible_keyword():
    result = parse_transaction_entities("Combustible para el carro 25 eur")

    assert result.category == "Gasolina"
    assert result.currency == "EUR"
    assert result.amount == 25.0


def test_unmatched_category_returns_none():
    result = parse_transaction_entities("Compré un libro de 20 usd")

    assert result.category is None
    assert result.amount == 20.0
    assert result.currency == "USD"


def test_infers_regalo_category():
    result = parse_transaction_entities("Compré un regalo de 20 usd")

    assert result.category == "Regalo"


# Caso puntual reportado: "hice una vaca" no comparte ninguna letra con "Salidas",
# es una expresion idiomatica - solo una lista curada de frases (no una corrección
# difusa por similitud de texto) puede conectar esto a la categoría correcta.
def test_infers_salidas_category_from_vaca_phrase():
    result = parse_transaction_entities("Hice una vaca con los panas para el cumpleaños, 41 usdt")

    assert result.category == "Salidas"
