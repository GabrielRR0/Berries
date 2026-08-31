"""Catálogo canónico de monedas soportadas (code, name, symbol, locale). Vive en un
solo lugar para que la migración que las siembra (ver alembic/versions/
*_create_currencies_table.py) y el fixture de tests (tests/conftest.py, que no corre
migraciones reales - solo Base.metadata.create_all()) nunca queden desincronizados
entre sí, mismo criterio que default_categories.py. Debe coincidir con
frontend/src/utils/currency/supportedCurrencies.ts (la app ofrece las mismas 6 monedas
en ambos lados)."""

SUPPORTED_CURRENCIES: list[tuple[str, str, str, str]] = [
    # (code, name, symbol, locale)
    ("USD", "Dólar estadounidense", "$", "en-US"),
    ("EUR", "Euro", "€", "de-DE"),
    ("VEF", "Bolívar", "Bs", "es-VE"),
    ("USDT", "Tether (USDT)", "USDT", "en-US"),
    ("COP", "Peso colombiano", "$", "es-CO"),
    ("ARS", "Peso argentino", "$", "es-AR"),
]
