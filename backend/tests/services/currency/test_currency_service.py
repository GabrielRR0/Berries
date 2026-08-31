from datetime import datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import select

from app.models.currency.exchange_rate_model import ExchangeRate
from app.services.currency.currency_lookup import get_currency_by_code
from app.services.currency.currency_service import convert, get_conversion_rate


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
