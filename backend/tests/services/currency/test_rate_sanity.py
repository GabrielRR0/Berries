from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import select

from app.models.currency.exchange_rate_model import ExchangeRate
from app.services.auth.auth_service import register_user
from app.services.currency.currency_lookup import get_currency_by_code
from app.services.currency.currency_service import audit_vef_rates, backfill_historical_vef_rates
from app.services.currency.rates.cache_refresh import get_fresh_rate
from app.services.currency.rates.rate_sanity import is_plausible_change
from app.services.transactions.transaction_service import create_transaction
from app.services.wallets.wallet_service import create_wallet


def _store_real_rate(db, bs_per_usd: Decimal, fetched_at: datetime, *, source: str | None = "dolarapi-oficial") -> None:
    usd = get_currency_by_code(db, "USD")
    vef = get_currency_by_code(db, "VEF")
    db.add(
        ExchangeRate(
            base_currency_id=vef.id,
            quote_currency_id=usd.id,
            rate=Decimal("1") / bs_per_usd,
            fetched_at=fetched_at,
            source=source,
            is_estimated=False,
        )
    )
    db.commit()


def _latest_vef_to_usd(db) -> ExchangeRate:
    usd = get_currency_by_code(db, "USD")
    vef = get_currency_by_code(db, "VEF")
    return db.scalars(
        select(ExchangeRate)
        .where(ExchangeRate.base_currency_id == vef.id, ExchangeRate.quote_currency_id == usd.id)
        .order_by(ExchangeRate.fetched_at.desc())
    ).first()


# --- is_plausible_change ----------------------------------------------------------------------------------


def test_a_small_move_is_plausible_and_a_jump_to_the_old_fallback_is_not():
    assert is_plausible_change(Decimal("880"), Decimal("875"), timedelta(days=1)) is True
    assert is_plausible_change(Decimal("36.5"), Decimal("875"), timedelta(days=1)) is False


def test_the_check_is_symmetric_under_inversion():
    # 1/36,5 frente a 1/875 es el mismo salto visto del otro lado (VEF->USD en vez de USD->VEF).
    assert is_plausible_change(Decimal("1") / Decimal("36.5"), Decimal("1") / Decimal("875"), timedelta(days=1)) is False
    assert is_plausible_change(Decimal("1") / Decimal("880"), Decimal("1") / Decimal("875"), timedelta(days=1)) is True


def test_the_allowed_move_grows_with_the_time_since_the_last_real_reading():
    # Un salto de 1,4x en un dia es raro; el mismo en 20 dias, con inflacion fuerte, es posible.
    assert is_plausible_change(Decimal("1.4"), Decimal("1"), timedelta(days=1)) is False
    assert is_plausible_change(Decimal("1.4"), Decimal("1"), timedelta(days=20)) is True


def test_a_very_old_reference_is_not_comparable_anymore():
    assert is_plausible_change(Decimal("36.5"), Decimal("875"), timedelta(days=90)) is True


def test_without_a_reference_anything_positive_is_accepted_and_non_positive_never():
    assert is_plausible_change(Decimal("36.5"), None) is True
    assert is_plausible_change(Decimal("0"), Decimal("875")) is False
    assert is_plausible_change(Decimal("-5"), None) is False


# --- al guardar una tasa nueva ----------------------------------------------------------------------------


def test_a_live_reading_that_jumps_is_not_stored_as_a_real_rate(db, monkeypatch):
    """El caso real: una lectura de 36,5 Bs por USD (el respaldo viejo) cuando la ultima real era ~875."""
    _store_real_rate(db, Decimal("875"), datetime.now(timezone.utc) - timedelta(days=3))
    monkeypatch.setattr("app.services.currency.rates.cache_refresh.fetch_vef_rate", lambda: (Decimal("36.5"), False))

    rate = get_fresh_rate(db, "VEF", "USD")

    # Se devuelve la ultima real (no el valor absurdo) y la fila nueva queda marcada como estimada.
    assert round(Decimal("1") / rate, 2) == Decimal("875.00")
    stored = _latest_vef_to_usd(db)
    assert stored.is_estimated is True
    assert "suspicious" in stored.source
    assert round(Decimal("1") / stored.rate, 2) == Decimal("875.00")


def test_a_normal_live_reading_is_stored_as_real(db, monkeypatch):
    _store_real_rate(db, Decimal("875"), datetime.now(timezone.utc) - timedelta(days=3))
    monkeypatch.setattr("app.services.currency.rates.cache_refresh.fetch_vef_rate", lambda: (Decimal("880"), False))

    get_fresh_rate(db, "VEF", "USD")

    stored = _latest_vef_to_usd(db)
    assert stored.is_estimated is False
    assert round(Decimal("1") / stored.rate, 2) == Decimal("880.00")


def test_the_very_first_reading_has_nothing_to_compare_with_and_is_accepted(db, monkeypatch):
    monkeypatch.setattr("app.services.currency.rates.cache_refresh.fetch_vef_rate", lambda: (Decimal("850"), False))

    get_fresh_rate(db, "VEF", "USD")

    assert _latest_vef_to_usd(db).is_estimated is False


# --- en el historico --------------------------------------------------------------------------------------


def test_the_history_backfill_skips_a_day_that_jumps_from_the_previous_one(db, monkeypatch):
    monkeypatch.setattr(
        "app.services.currency.currency_service.fetch_vef_rate_history",
        lambda: [
            (date(2026, 10, 7), Decimal("873.867")),
            (date(2026, 10, 8), Decimal("36.5")),  # dato corrupto del proveedor
            (date(2026, 10, 9), Decimal("875.6505")),
        ],
    )

    inserted = backfill_historical_vef_rates(db)

    assert inserted == 2
    days = {row.fetched_at.date() for row in db.scalars(select(ExchangeRate))}
    assert days == {date(2026, 10, 7), date(2026, 10, 9)}


def test_the_history_backfill_keeps_a_normal_series_intact(db, monkeypatch):
    monkeypatch.setattr(
        "app.services.currency.currency_service.fetch_vef_rate_history",
        lambda: [(date(2026, 10, 7), Decimal("873.867")), (date(2026, 10, 8), Decimal("874.7321")), (date(2026, 10, 9), Decimal("875.6505"))],
    )

    assert backfill_historical_vef_rates(db) == 3


# --- auditoria (solo lectura) -----------------------------------------------------------------------------


def test_the_audit_finds_a_bad_rate_and_the_transactions_frozen_with_it(db, monkeypatch):
    user = register_user(db, "ana@example.com", "clave12345", "Ana")
    wallet = create_wallet(db, user.id, "Banco Vnz", "VEF")
    # La fila mala de verdad: 36,5 Bs por USD guardada como real el 21 de septiembre.
    _store_real_rate(db, Decimal("36.5"), datetime(2026, 9, 21, 16, 9, 59, tzinfo=timezone.utc), source=None)
    transaction = create_transaction(
        db,
        user.id,
        wallet.id,
        "expense",
        Decimal("36500"),
        "Mercado",
        occurred_at=datetime(2026, 9, 21, 19, 0, tzinfo=timezone.utc),
    )
    assert round(transaction.reference_amount_usd) == 1000  # el sintoma que se vio en pantalla

    monkeypatch.setattr(
        "app.services.currency.currency_service.fetch_vef_rate_history", lambda: [(date(2026, 9, 21), Decimal("849.564"))]
    )
    audit = audit_vef_rates(db)

    assert not audit.is_clean
    assert [item["bs_per_usd"] for item in audit.bad_rates] == [Decimal("36.5000")]
    assert [item["id"] for item in audit.affected_transactions] == [str(transaction.id)]


def test_the_audit_is_clean_when_everything_matches_the_published_rates(db, monkeypatch):
    _store_real_rate(db, Decimal("849.564"), datetime(2026, 9, 21, 12, 0, tzinfo=timezone.utc))
    monkeypatch.setattr(
        "app.services.currency.currency_service.fetch_vef_rate_history", lambda: [(date(2026, 9, 21), Decimal("849.564"))]
    )

    audit = audit_vef_rates(db)

    assert audit.is_clean


def test_the_audit_compares_a_weekend_with_the_last_business_day(db, monkeypatch):
    # Sabado 3 de octubre: el BCV no publica; se compara con el viernes 2.
    _store_real_rate(db, Decimal("866.5612"), datetime(2026, 10, 3, 12, 0, tzinfo=timezone.utc))
    monkeypatch.setattr(
        "app.services.currency.currency_service.fetch_vef_rate_history", lambda: [(date(2026, 10, 2), Decimal("866.5612"))]
    )

    assert audit_vef_rates(db).is_clean
