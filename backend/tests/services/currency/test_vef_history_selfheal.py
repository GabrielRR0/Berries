from datetime import date, datetime, timezone
from decimal import Decimal

import pytest
from sqlalchemy import select

from app.models.currency.exchange_rate_model import ExchangeRate
from app.models.wallets.wallet_model import Wallet
from app.services.auth.auth_service import register_user
from app.services.currency.currency_lookup import get_currency_by_code
from app.services.currency.currency_service import get_conversion_rate_at
from app.services.transactions.errors import TransactionValidationError
from app.services.transactions.transaction_service import create_transaction, create_transactions_bulk
from app.services.wallets.wallet_service import create_wallet

# Caso real: la tasa del 8 de octubre de 2026 era 874,7321 Bs por USD, pero en la base solo habia
# la del 28 de septiembre (857,0058) y un gasto del 8 de octubre se congelaba con esa.
def bs_per_usd(vef_to_usd_rate: Decimal) -> Decimal:
    """De la tasa guardada (USD por 1 VEF) a la forma en que se lee: bolivares por dolar, a 4 decimales."""
    return round(Decimal("1") / vef_to_usd_rate, 4)


SEPT_28_RATE = Decimal("857.0058")
OCT_8_RATE = Decimal("874.7321")
HISTORY_API = [
    (date(2026, 10, 7), Decimal("873.867")),
    (date(2026, 10, 8), OCT_8_RATE),
    (date(2026, 10, 9), Decimal("875.6505")),
]


@pytest.fixture
def history_calls(monkeypatch):
    """Sustituye el historico del proveedor por uno propio y cuenta cuantas veces se consulta."""
    calls: list[int] = []

    def fake_history():
        calls.append(1)
        return HISTORY_API

    monkeypatch.setattr("app.services.currency.currency_service.fetch_vef_rate_history", fake_history)
    return calls


def _store_vef_rate(db, usd_per_vef_denominator: Decimal, fetched_at: datetime) -> None:
    """Guarda una tasa VEF->USD (1 VEF = 1/denominador USD), como las que deja la app on-demand."""
    usd = get_currency_by_code(db, "USD")
    vef = get_currency_by_code(db, "VEF")
    db.add(
        ExchangeRate(
            base_currency_id=vef.id,
            quote_currency_id=usd.id,
            rate=Decimal("1") / usd_per_vef_denominator,
            fetched_at=fetched_at,
            source="dolarapi-oficial",
            is_estimated=False,
        )
    )
    db.commit()


def test_a_stale_rate_triggers_the_history_backfill_and_uses_the_real_rate_of_that_day(db, history_calls):
    _store_vef_rate(db, SEPT_28_RATE, datetime(2026, 9, 28, 12, 48, tzinfo=timezone.utc))
    occurred_at = datetime(2026, 10, 8, 23, 51, tzinfo=timezone.utc)

    rate = get_conversion_rate_at(db, "VEF", "USD", occurred_at)

    assert history_calls == [1]
    assert bs_per_usd(rate) == OCT_8_RATE
    # 22.848 Bs valen ~$26,12 ese dia (no los $26,66 que salian con la tasa de hace diez dias).
    assert round(Decimal("22848") * rate, 2) == Decimal("26.12")
    # y NO los ~$26,66 que salian con la tasa de hace diez dias.
    assert round(Decimal("22848") / SEPT_28_RATE, 2) == Decimal("26.66")


def test_a_recent_enough_rate_is_used_without_calling_the_provider(db, history_calls):
    # Viernes 2 de octubre al mediodia; el lunes 5 temprano solo pasaron ~2,8 dias (fin de semana normal).
    _store_vef_rate(db, Decimal("866.5612"), datetime(2026, 10, 2, 12, 0, tzinfo=timezone.utc))

    rate = get_conversion_rate_at(db, "VEF", "USD", datetime(2026, 10, 5, 8, 0, tzinfo=timezone.utc))

    assert history_calls == []
    assert bs_per_usd(rate) == Decimal("866.5612")


def test_without_any_rate_before_the_date_the_history_is_fetched(db, history_calls):
    rate = get_conversion_rate_at(db, "VEF", "USD", datetime(2026, 10, 8, 12, 0, tzinfo=timezone.utc))

    assert history_calls == [1]
    assert bs_per_usd(rate) == OCT_8_RATE


def test_the_provider_is_not_called_again_right_after_trying(db, monkeypatch):
    """Si el proveedor no tiene esos dias (ej. fechas muy recientes), no se le vuelve a pegar en
    cada movimiento: hay un enfriamiento tras cada intento."""
    calls: list[int] = []
    monkeypatch.setattr(
        "app.services.currency.currency_service.fetch_vef_rate_history",
        lambda: calls.append(1) or [(date(2026, 9, 28), SEPT_28_RATE)],
    )
    _store_vef_rate(db, SEPT_28_RATE, datetime(2026, 9, 28, 12, 0, tzinfo=timezone.utc))

    get_conversion_rate_at(db, "VEF", "USD", datetime(2026, 10, 8, 12, 0, tzinfo=timezone.utc))
    get_conversion_rate_at(db, "VEF", "USD", datetime(2026, 10, 9, 12, 0, tzinfo=timezone.utc))
    get_conversion_rate_at(db, "VEF", "USD", datetime(2026, 10, 8, 15, 0, tzinfo=timezone.utc))

    assert calls == [1]


def test_if_the_provider_fails_it_falls_back_to_the_closest_stored_rate(db, monkeypatch):
    def broken_history():
        raise RuntimeError("dolarapi no responde")

    monkeypatch.setattr("app.services.currency.currency_service.fetch_vef_rate_history", broken_history)
    _store_vef_rate(db, SEPT_28_RATE, datetime(2026, 9, 28, 12, 0, tzinfo=timezone.utc))

    rate = get_conversion_rate_at(db, "VEF", "USD", datetime(2026, 10, 8, 12, 0, tzinfo=timezone.utc))

    assert bs_per_usd(rate) == SEPT_28_RATE


def test_pairs_without_the_bolivar_never_call_the_vef_provider(db, history_calls):
    get_conversion_rate_at(db, "USD", "USD", datetime(2026, 10, 8, tzinfo=timezone.utc))

    assert history_calls == []


def test_a_transaction_backdated_to_oct_8_freezes_the_real_rate_of_that_day(db, history_calls):
    user = register_user(db, "ana@example.com", "clave12345", "Ana")
    wallet = create_wallet(db, user.id, "Banco Vnz", "VEF")
    _store_vef_rate(db, SEPT_28_RATE, datetime(2026, 9, 28, 12, 48, tzinfo=timezone.utc))

    transaction = create_transaction(
        db,
        user.id,
        wallet.id,
        "expense",
        Decimal("22848"),
        "Mercado",
        occurred_at=datetime(2026, 10, 8, 23, 51, tzinfo=timezone.utc),
    )

    assert round(transaction.reference_rate, 4) == OCT_8_RATE
    assert round(transaction.reference_amount_usd, 2) == Decimal("26.12")


def test_a_bulk_import_also_uses_the_real_rate_of_each_day(db, history_calls):
    user = register_user(db, "ana@example.com", "clave12345", "Ana")
    wallet = create_wallet(db, user.id, "Banco Vnz", "VEF")
    _store_vef_rate(db, SEPT_28_RATE, datetime(2026, 9, 28, 12, 48, tzinfo=timezone.utc))

    created = create_transactions_bulk(
        db,
        user.id,
        [
            {
                "wallet_id": wallet.id,
                "type": "expense",
                "amount": Decimal("22848"),
                "category": "Mercado",
                "occurred_at": datetime(2026, 10, 8, 23, 51, tzinfo=timezone.utc),
            },
            {
                "wallet_id": wallet.id,
                "type": "expense",
                "amount": Decimal("68.54"),
                "category": "Comisión",
                "occurred_at": datetime(2026, 10, 7, 20, 0, tzinfo=timezone.utc),
            },
        ],
    )

    assert [round(t.reference_rate, 4) for t in created] == [OCT_8_RATE, Decimal("873.8670")]


def test_the_bulk_import_stays_all_or_nothing_even_when_the_history_has_to_be_fetched(db, history_calls):
    """El backfill hace commit al insertar tasas; por eso se hace ANTES de tocar saldos. Si despues
    falla un movimiento del lote, ninguno queda registrado ni se altera ningun saldo."""
    user = register_user(db, "ana@example.com", "clave12345", "Ana")
    other = register_user(db, "otro@example.com", "clave12345", "Otro")
    mine = create_wallet(db, user.id, "Banco Vnz", "VEF")
    foreign = create_wallet(db, other.id, "Ajena", "VEF")
    _store_vef_rate(db, SEPT_28_RATE, datetime(2026, 9, 28, 12, 48, tzinfo=timezone.utc))
    when = datetime(2026, 10, 8, 23, 51, tzinfo=timezone.utc)

    with pytest.raises(TransactionValidationError):
        create_transactions_bulk(
            db,
            user.id,
            [
                {"wallet_id": mine.id, "type": "expense", "amount": Decimal("1000"), "category": "Mercado", "occurred_at": when},
                {"wallet_id": foreign.id, "type": "expense", "amount": Decimal("50"), "category": "Mercado", "occurred_at": when},
            ],
        )

    db.refresh(mine)
    assert mine.balance == Decimal("0")
    assert history_calls == [1]
    # Las tasas del historico si quedaron guardadas (son datos publicos, no del lote).
    vef = get_currency_by_code(db, "VEF")
    assert db.scalar(select(ExchangeRate).where(ExchangeRate.base_currency_id == vef.id, ExchangeRate.fetched_at == datetime(2026, 10, 8, tzinfo=timezone.utc)))
    assert db.scalars(select(Wallet).where(Wallet.id == mine.id)).one().balance == Decimal("0")


def test_one_update_covers_every_date_up_to_today_without_calling_again(db, history_calls, monkeypatch):
    """La serie llega completa en una sola respuesta: tras actualizar, ninguna fecha hasta el ultimo
    dia traido vuelve a consultar al proveedor, ni siquiera pasado el enfriamiento."""
    import app.services.currency.currency_service as currency_service

    _store_vef_rate(db, SEPT_28_RATE, datetime(2026, 9, 28, 12, 48, tzinfo=timezone.utc))

    get_conversion_rate_at(db, "VEF", "USD", datetime(2026, 10, 8, 12, 0, tzinfo=timezone.utc))
    assert history_calls == [1]

    # Pasa el enfriamiento y se piden otras fechas dentro de lo ya traido (hasta el 9 de octubre).
    monkeypatch.setattr(currency_service, "_last_vef_backfill_attempt", None)
    for day in (7, 8, 9):
        get_conversion_rate_at(db, "VEF", "USD", datetime(2026, 10, day, 15, 0, tzinfo=timezone.utc))

    assert history_calls == [1]


def test_a_date_after_the_last_published_day_does_ask_again(db, history_calls, monkeypatch):
    import app.services.currency.currency_service as currency_service

    _store_vef_rate(db, SEPT_28_RATE, datetime(2026, 9, 28, 12, 48, tzinfo=timezone.utc))
    get_conversion_rate_at(db, "VEF", "USD", datetime(2026, 10, 8, 12, 0, tzinfo=timezone.utc))
    assert history_calls == [1]

    # Ya con la serie hasta el 9; el 13 queda a mas de 3 dias de la ultima tasa guardada: dato nuevo.
    monkeypatch.setattr(currency_service, "_last_vef_backfill_attempt", None)
    get_conversion_rate_at(db, "VEF", "USD", datetime(2026, 10, 13, 12, 0, tzinfo=timezone.utc))

    assert history_calls == [1, 1]


def _store_rate(db, bs_per_usd: Decimal, fetched_at: datetime, *, estimated: bool, source: str | None = "dolarapi-oficial") -> None:
    usd = get_currency_by_code(db, "USD")
    vef = get_currency_by_code(db, "VEF")
    db.add(
        ExchangeRate(
            base_currency_id=vef.id,
            quote_currency_id=usd.id,
            rate=Decimal("1") / bs_per_usd,
            fetched_at=fetched_at,
            source=source,
            is_estimated=estimated,
        )
    )
    db.commit()


def test_a_real_rate_always_beats_a_more_recent_estimated_one(db, history_calls):
    """Bug real: una fila de respaldo (36,5 Bs por USD) mas reciente que la tasa real tapaba a la real y un
    gasto de 36.500 Bs se congelaba como $1.000. Las estimadas solo valen si no hay ninguna real."""
    _store_rate(db, Decimal("849.564"), datetime(2026, 9, 21, 16, 9, 49, tzinfo=timezone.utc), estimated=False)
    _store_rate(db, Decimal("36.5"), datetime(2026, 9, 21, 16, 9, 59, tzinfo=timezone.utc), estimated=True, source="fallback-stale")

    rate = get_conversion_rate_at(db, "VEF", "USD", datetime(2026, 9, 21, 19, 0, tzinfo=timezone.utc))

    assert bs_per_usd(rate) == Decimal("849.5640")
    # 36.500 Bs valen ~$43, no $1.000.
    assert round(Decimal("36500") * rate, 2) == Decimal("42.96")


def test_estimated_rates_are_still_used_when_there_is_no_real_one(db):
    """Sin ninguna lectura real para el par (y sin historico disponible: el proveedor devuelve vacio, como
    en el resto de los tests), una estimada sigue siendo mejor que nada."""
    _store_rate(db, Decimal("36.5"), datetime(2026, 9, 21, 16, 9, 59, tzinfo=timezone.utc), estimated=True, source="fallback-stale")

    rate = get_conversion_rate_at(db, "VEF", "USD", datetime(2026, 9, 21, 19, 0, tzinfo=timezone.utc))

    assert bs_per_usd(rate) == Decimal("36.5000")


def test_a_later_real_rate_is_preferred_over_an_earlier_estimated_one_as_the_anchor(db):
    _store_rate(db, Decimal("36.5"), datetime(2026, 9, 1, 12, 0, tzinfo=timezone.utc), estimated=True, source="fallback-stale")
    _store_rate(db, Decimal("850"), datetime(2026, 9, 22, 12, 0, tzinfo=timezone.utc), estimated=False)

    # Ninguna real es anterior a esa fecha: se prefiere la real mas cercana (aunque sea posterior) a la estimada.
    rate = get_conversion_rate_at(db, "VEF", "USD", datetime(2026, 9, 10, 12, 0, tzinfo=timezone.utc))

    assert bs_per_usd(rate) == Decimal("850.0000")
