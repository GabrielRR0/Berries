from datetime import datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import select

from app.models.currency.exchange_rate_model import ExchangeRate
from app.services.auth.auth_service import register_user
from app.services.currency.currency_lookup import get_currency_by_code
from app.services.currency.currency_service import (
    convert,
    get_conversion_rate,
    get_conversion_rate_at,
    refresh_all_active_currencies,
)
from app.services.wallets.wallet_service import create_wallet


def test_convert_same_currency_returns_amount_unchanged(db):
    result = convert(db, Decimal("100.00"), "USD", "USD")

    assert result == Decimal("100.00")


def test_convert_cross_currency_uses_fallback_rates(db):
    # Sin OPEN_EXCHANGE_RATES_APP_ID configurado, fetch_fiat_rates devuelve el fallback
    # documentado (VEF=36.5 relativo a USD) — no se afirma una tasa de mercado real.
    result = convert(db, Decimal("100"), "USD", "VEF")

    assert result == Decimal("3650.0")


def test_convert_round_trip_is_internally_consistent(db):
    converted = convert(db, Decimal("100"), "USD", "VEF")
    back = convert(db, converted, "VEF", "USD")

    assert back == Decimal("100")


def test_convert_pivots_through_usd_for_two_non_usd_currencies(db):
    converted = convert(db, Decimal("100"), "VEF", "EUR")

    assert converted > 0
    # 100 VEF -> USD -> EUR debe ser mucho menor a 100 (VEF vale mucho menos que EUR).
    assert converted < Decimal("100")


def test_get_conversion_rate_is_one_for_same_currency(db):
    assert get_conversion_rate(db, "USD", "USD") == Decimal("1")


def test_get_fresh_rate_is_cached_and_does_not_refetch_within_ttl(db):
    convert(db, Decimal("1"), "USD", "VEF")
    convert(db, Decimal("1"), "USD", "VEF")

    # Unica pareja de moneda que este test toca - contar todas las filas de la tabla
    # (en vez de filtrar por base_currency_id/quote_currency_id) alcanza para confirmar
    # que la segunda llamada uso el cache en vez de crear una fila nueva.
    rows = list(db.scalars(select(ExchangeRate)))
    assert len(rows) == 1


def test_get_fresh_rate_refreshes_when_stale(db):
    usd = get_currency_by_code(db, "USD")
    eur = get_currency_by_code(db, "EUR")
    stale = ExchangeRate(
        base_currency_id=usd.id,
        quote_currency_id=eur.id,
        rate=Decimal("0.50"),  # deliberadamente distinto del fallback, para notar el refresh
        fetched_at=datetime.now(timezone.utc) - timedelta(hours=999),
    )
    db.add(stale)
    db.commit()

    convert(db, Decimal("1"), "USD", "EUR")

    rows = list(db.scalars(select(ExchangeRate)))
    assert len(rows) == 2


# --- get_conversion_rate_at (bug real reportado por el usuario: un gasto viejo en una
# moneda con inflación fuerte no debe reconvertirse con la tasa de HOY - ver docstring
# de analytics_service.py) ------------------------------------------------------------


def test_get_conversion_rate_at_uses_the_rate_valid_on_that_date_not_the_newest_one(db):
    usd = get_currency_by_code(db, "USD")
    vef = get_currency_by_code(db, "VEF")
    old_date = datetime(2026, 6, 1, tzinfo=timezone.utc)
    new_date = datetime(2026, 8, 1, tzinfo=timezone.utc)
    # get_rate_at(db, "VEF", "USD", ...) consulta base=VEF/quote=USD (mismo par que
    # _rate_to_usd) - la fila guarda "1 VEF = rate USD". Hace meses, 1 USD = 50 VEF (1
    # VEF = 1/50 USD); mas tarde (por inflación), 1 USD = 200 VEF (1 VEF = 1/200 USD).
    db.add(
        ExchangeRate(
            base_currency_id=vef.id, quote_currency_id=usd.id, rate=Decimal("1") / Decimal("50"), fetched_at=old_date
        )
    )
    db.add(
        ExchangeRate(
            base_currency_id=vef.id, quote_currency_id=usd.id, rate=Decimal("1") / Decimal("200"), fetched_at=new_date
        )
    )
    db.commit()

    # Un gasto de 500 VEF ocurrido ENTRE las dos fechas (mas cerca de la vieja) debe usar
    # la tasa vieja (1/50), no la nueva (1/200) - aunque la nueva ya exista en la tabla.
    at = datetime(2026, 6, 15, tzinfo=timezone.utc)
    rate = get_conversion_rate_at(db, "VEF", "USD", at)

    assert rate == Decimal("1") / Decimal("50")


def test_get_conversion_rate_at_does_not_let_a_later_rate_leak_into_the_past(db):
    """El mismo escenario de arriba, pero mirando el resultado final convertido (no solo
    la tasa cruda) - 500 VEF con la tasa vieja (1 USD=50 VEF) son $10; con la nueva (1
    USD=200 VEF) serian $2.50. Confirma que analytics_service.py (que llama a esto)
    nunca reescribe un mes ya cerrado."""
    usd = get_currency_by_code(db, "USD")
    vef = get_currency_by_code(db, "VEF")
    db.add(
        ExchangeRate(
            base_currency_id=vef.id,
            quote_currency_id=usd.id,
            rate=Decimal("1") / Decimal("50"),
            fetched_at=datetime(2026, 6, 1, tzinfo=timezone.utc),
        )
    )
    db.add(
        ExchangeRate(
            base_currency_id=vef.id,
            quote_currency_id=usd.id,
            rate=Decimal("1") / Decimal("200"),
            fetched_at=datetime(2026, 8, 1, tzinfo=timezone.utc),
        )
    )
    db.commit()

    rate = get_conversion_rate_at(db, "VEF", "USD", datetime(2026, 6, 15, tzinfo=timezone.utc))

    assert Decimal("500") * rate == Decimal("10")


def test_get_conversion_rate_at_same_currency_is_one(db):
    assert get_conversion_rate_at(db, "USD", "USD", datetime(2020, 1, 1, tzinfo=timezone.utc)) == Decimal("1")


def test_get_conversion_rate_at_falls_back_to_fresh_rate_without_any_history(db):
    """Si el par nunca se consultó antes de esa fecha (primera vez que se usa esta
    moneda en la app), no hay mejor dato que la tasa disponible ahora."""
    rate = get_conversion_rate_at(db, "USD", "VEF", datetime(2020, 1, 1, tzinfo=timezone.utc))

    assert rate == Decimal("36.5")  # fallback documentado, ver test_convert_cross_currency_uses_fallback_rates


# --- refresh_all_active_currencies (cron diario de Vercel, ver cron_router.py) -------


def test_refresh_all_active_currencies_only_refreshes_currencies_actually_in_use(db):
    user = register_user(db, "ana@example.com", "clave12345", "Ana")
    create_wallet(db, user.id, "Efectivo", "VEF")

    refreshed = refresh_all_active_currencies(db)

    assert refreshed == ["VEF"]
    rows = list(db.scalars(select(ExchangeRate)))
    fetched_pairs = {(row.base_currency_id, row.quote_currency_id) for row in rows}
    vef = get_currency_by_code(db, "VEF")
    usd = get_currency_by_code(db, "USD")
    # Ambas direcciones (VEF->USD y USD->VEF): get_conversion_rate pivotea siempre por
    # USD y cachea cada dirección como su propia fila (ver _rate_to_usd/_rate_from_usd).
    assert (vef.id, usd.id) in fetched_pairs
    assert (usd.id, vef.id) in fetched_pairs
    # Ninguna otra moneda soportada (EUR, ARS, COP, USDT...) estaba en uso - no debe
    # haber gastado una llamada de red/fila de cache para ellas.
    assert len(rows) == 2


def test_refresh_all_active_currencies_excludes_usd_itself(db):
    user = register_user(db, "ana@example.com", "clave12345", "Ana")
    create_wallet(db, user.id, "Efectivo", "USD")

    refreshed = refresh_all_active_currencies(db)

    assert refreshed == []
    assert list(db.scalars(select(ExchangeRate))) == []


def test_refresh_all_active_currencies_includes_a_users_default_currency_even_without_a_wallet(db):
    # Cuenta recien registrada con moneda principal COP pero que todavia no creo
    # ninguna wallet - igual necesita su tasa disponible (ej. para mostrar montos en
    # COP en cuanto cree su primer movimiento).
    register_user(db, "ana@example.com", "clave12345", "Ana", default_currency="COP")

    refreshed = refresh_all_active_currencies(db)

    assert refreshed == ["COP"]


def test_refresh_all_active_currencies_deduplicates_and_sorts_currencies(db):
    user = register_user(db, "ana@example.com", "clave12345", "Ana", default_currency="VEF")
    # Dos wallets distintas en la misma moneda no deben pedir la tasa dos veces.
    create_wallet(db, user.id, "Efectivo", "VEF")
    create_wallet(db, user.id, "Binance", "VEF")
    create_wallet(db, user.id, "Ahorros", "EUR")

    refreshed = refresh_all_active_currencies(db)

    assert refreshed == ["EUR", "VEF"]
