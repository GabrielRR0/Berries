from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import select

from app.models.currency.exchange_rate_model import ExchangeRate
from app.services.auth.auth_service import register_user
from app.services.currency.currency_lookup import get_currency_by_code
from app.services.currency.currency_service import (
    backfill_historical_vef_rates,
    convert,
    convert_at,
    get_conversion_rate,
    get_conversion_rate_at,
    get_rate_history,
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
    """Si el par nunca se consultó, ni antes ni después de esa fecha (no existe ninguna
    fila), no hay mejor dato que la tasa disponible ahora."""
    rate = get_conversion_rate_at(db, "USD", "VEF", datetime(2020, 1, 1, tzinfo=timezone.utc))

    assert rate == Decimal("36.5")  # fallback documentado, ver test_convert_cross_currency_uses_fallback_rates


def test_get_conversion_rate_at_uses_the_oldest_available_rate_when_none_predates_it(db):
    """Bug real corregido: antes, si no existía ninguna fila con fetched_at <= `at`, se
    caía a get_fresh_rate (la tasa de HOY, mal etiquetada como histórica) aun cuando ya
    existiera una fila real posterior a `at` para ese mismo par - la mejor ancla
    histórica disponible. Ahora se prefiere esa fila real (aunque sea posterior) antes
    de recién a traer/crear una tasa "en vivo"."""
    usd = get_currency_by_code(db, "USD")
    vef = get_currency_by_code(db, "VEF")
    only_row_date = datetime(2026, 8, 1, tzinfo=timezone.utc)
    db.add(
        ExchangeRate(
            base_currency_id=vef.id,
            quote_currency_id=usd.id,
            rate=Decimal("1") / Decimal("80"),
            fetched_at=only_row_date,
        )
    )
    db.commit()

    at = datetime(2026, 6, 1, tzinfo=timezone.utc)  # anterior a la única fila que existe
    rate = get_conversion_rate_at(db, "VEF", "USD", at)

    assert rate == Decimal("1") / Decimal("80")
    # No debe haber creado una fila nueva (no llamó a get_fresh_rate).
    rows = list(db.scalars(select(ExchangeRate)))
    assert len(rows) == 1


# --- procedencia/confiabilidad de la tasa (source/is_estimated) ----------------------


def test_get_fresh_rate_reuses_last_real_rate_instead_of_a_stale_fallback(db, monkeypatch):
    """Bug real corregido: si el cliente de tasas devuelve un valor estimado (ej.
    dolarapi.com falló y se usó el respaldo hardcodeado de venezuela_rate_client.py),
    get_fresh_rate no debe guardar ese número tal cual - debe reusar la última tasa
    REAL ya conocida para el par, si existe."""
    usd = get_currency_by_code(db, "USD")
    vef = get_currency_by_code(db, "VEF")
    real_rate = Decimal("1") / Decimal("900")
    db.add(
        ExchangeRate(
            base_currency_id=vef.id,
            quote_currency_id=usd.id,
            rate=real_rate,
            fetched_at=datetime.now(timezone.utc) - timedelta(hours=999),  # stale, fuerza un refresh
            source="dolarapi-oficial",
            is_estimated=False,
        )
    )
    db.commit()
    monkeypatch.setattr(
        "app.services.currency.rates.cache_refresh.fetch_vef_rate",
        lambda: (Decimal("36.5"), True),  # simula que dolarapi.com falló justo ahora
    )

    rate = convert(db, Decimal("1"), "VEF", "USD")

    # round(...,10): ExchangeRate.rate es Numeric(24,10) - real_rate (1/900) es
    # periódico y pierde precisión más allá de esa cantidad de decimales al pasar por
    # la columna, igual que round(...,2) en otros tests de esta suite compara a la
    # precisión real que la columna preserva, no bit-a-bit contra el Decimal de Python.
    assert round(rate, 10) == round(real_rate, 10)  # reusa la última tasa real, no 1/36.5
    newest = db.scalar(
        select(ExchangeRate)
        .where(ExchangeRate.base_currency_id == vef.id, ExchangeRate.quote_currency_id == usd.id)
        .order_by(ExchangeRate.fetched_at.desc())
    )
    assert newest.is_estimated is True
    assert round(newest.rate, 10) == round(real_rate, 10)


def test_get_fresh_rate_uses_the_estimated_value_only_when_no_real_rate_ever_existed(db, monkeypatch):
    monkeypatch.setattr(
        "app.services.currency.rates.cache_refresh.fetch_vef_rate",
        lambda: (Decimal("36.5"), True),
    )

    rate = convert(db, Decimal("1"), "VEF", "USD")

    assert rate == Decimal("1") / Decimal("36.5")
    row = db.scalar(select(ExchangeRate))
    assert row.is_estimated is True
    assert row.source == "fallback-stale"


# --- get_rate_history (pagina "Tasas") -----------------------------------------------


def test_get_rate_history_defaults_to_usd_and_returns_ascending_by_fetched_at(db):
    usd = get_currency_by_code(db, "USD")
    vef = get_currency_by_code(db, "VEF")
    newer = datetime(2026, 8, 1, tzinfo=timezone.utc)
    older = datetime(2026, 7, 1, tzinfo=timezone.utc)
    db.add(ExchangeRate(base_currency_id=usd.id, quote_currency_id=vef.id, rate=Decimal("800"), fetched_at=newer))
    db.add(ExchangeRate(base_currency_id=usd.id, quote_currency_id=vef.id, rate=Decimal("750"), fetched_at=older))
    db.commit()

    rows = get_rate_history(db, "VEF", months=6)

    assert [row.rate for row in rows] == [Decimal("750"), Decimal("800")]


def test_get_rate_history_against_a_currency_other_than_usd(db):
    """Serie de tasas IMPLÍCITAS reales de las transferencias del usuario (ver
    transfer_service._record_transfer_rate_observation) - independiente de la serie
    oficial USD->VEF, aunque comparta la misma tabla."""
    usdt = get_currency_by_code(db, "USDT")
    vef = get_currency_by_code(db, "VEF")
    db.add(
        ExchangeRate(
            base_currency_id=usdt.id,
            quote_currency_id=vef.id,
            rate=Decimal("190"),
            fetched_at=datetime(2026, 9, 1, tzinfo=timezone.utc),
            source="user-transfer",
            is_estimated=False,
        )
    )
    db.commit()

    rows = get_rate_history(db, "VEF", against="USDT")

    assert len(rows) == 1
    assert rows[0].rate == Decimal("190")


def test_get_rate_history_only_returns_rows_within_the_months_window(db):
    usd = get_currency_by_code(db, "USD")
    vef = get_currency_by_code(db, "VEF")
    too_old = datetime.now(timezone.utc) - timedelta(days=400)
    db.add(ExchangeRate(base_currency_id=usd.id, quote_currency_id=vef.id, rate=Decimal("500"), fetched_at=too_old))
    db.commit()

    rows = get_rate_history(db, "VEF", months=6)

    assert rows == []


# --- backfill_historical_vef_rates (pedido explicito del usuario: "buscar registros
# anteriores... de hace un año para acá") --------------------------------------------


def test_backfill_historical_vef_rates_inserts_both_directions_for_each_day(db, monkeypatch):
    # promedio=800 significa "800 VEF = 1 USD" (la orientación real de dolarapi.com,
    # ver fetch_vef_rate_history) - NO "800 USD = 1 VEF". Bug real de esta sesión: las
    # dos direcciones quedaron invertidas al implementar esto, lo que multiplicaba
    # (en vez de dividir) cualquier monto en VEF por ~800 - se detectó por el propio
    # --dry-run de backfill:reference-amounts contra datos reales (saltos a millones
    # de dólares), antes de tocar producción. Este test verifica el RESULTADO de una
    # conversión real (no solo que algún valor quedó guardado), justamente para que
    # una inversión de dirección como esa no pueda volver a pasar desapercibida.
    monkeypatch.setattr(
        "app.services.currency.currency_service.fetch_vef_rate_history",
        lambda: [(date(2026, 8, 1), Decimal("800")), (date(2026, 8, 2), Decimal("810"))],
    )

    inserted = backfill_historical_vef_rates(db, months=12)

    assert inserted == 2
    rows = list(db.scalars(select(ExchangeRate)))
    assert len(rows) == 4  # 2 días x 2 direcciones
    usd = get_currency_by_code(db, "USD")
    vef = get_currency_by_code(db, "VEF")
    vef_to_usd_aug1 = next(
        r
        for r in rows
        if r.base_currency_id == vef.id and r.quote_currency_id == usd.id and r.fetched_at.date() == date(2026, 8, 1)
    )
    assert vef_to_usd_aug1.rate == Decimal("1") / Decimal("800")
    assert vef_to_usd_aug1.source == "dolarapi-oficial-historico"
    assert vef_to_usd_aug1.is_estimated is False
    usd_to_vef_aug1 = next(
        r
        for r in rows
        if r.base_currency_id == usd.id and r.quote_currency_id == vef.id and r.fetched_at.date() == date(2026, 8, 1)
    )
    assert usd_to_vef_aug1.rate == Decimal("800")

    # Chequeo de punta a punta: 800 VEF ese día deben valer ~1 USD, no 800 USD ni
    # 640.000 USD (los dos tipos de inversión de tasa que este bug podría producir).
    converted = convert_at(db, Decimal("800"), "VEF", "USD", datetime(2026, 8, 1, tzinfo=timezone.utc))
    assert round(converted, 4) == Decimal("1.0000")


def test_backfill_historical_vef_rates_is_idempotent(db, monkeypatch):
    monkeypatch.setattr(
        "app.services.currency.currency_service.fetch_vef_rate_history",
        lambda: [(date(2026, 8, 1), Decimal("800"))],
    )

    first = backfill_historical_vef_rates(db, months=12)
    second = backfill_historical_vef_rates(db, months=12)

    assert first == 1
    assert second == 0  # el día ya existía, no se duplica


def test_backfill_historical_vef_rates_skips_days_older_than_the_requested_window(db, monkeypatch):
    too_old = (datetime.now(timezone.utc) - timedelta(days=400)).date()
    monkeypatch.setattr(
        "app.services.currency.currency_service.fetch_vef_rate_history",
        lambda: [(too_old, Decimal("500")), (datetime.now(timezone.utc).date(), Decimal("850"))],
    )

    inserted = backfill_historical_vef_rates(db, months=12)

    assert inserted == 1


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
