from datetime import datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.models.currency.exchange_rate_model import ExchangeRate
from app.services.currency.currency_lookup import get_currency_by_code
from app.services.currency.rates.crypto_rate_client import fetch_crypto_rates
from app.services.currency.rates.fiat_rate_client import fetch_fiat_rates


def _fetch_rate_from_client(base_currency: str, quote_currency: str) -> Decimal:
    """Resuelve una tasa directa donde uno de los dos lados es USD o USDT (los únicos
    pivotes que los clientes de tasas conocen). Pares sin USD/USDT en ninguno de los dos
    lados deben resolverse en currency_service pivoteando por USD, no acá."""
    if quote_currency == "USDT":
        rates = fetch_crypto_rates()
        return rates["USDT"]
    if base_currency == "USDT":
        rates = fetch_crypto_rates()
        return Decimal("1") / rates["USDT"]

    if base_currency == "USD":
        rates = fetch_fiat_rates()
        return rates[quote_currency]
    if quote_currency == "USD":
        rates = fetch_fiat_rates()
        return Decimal("1") / rates[base_currency]

    raise ValueError(f"No se puede resolver una tasa directa para {base_currency}/{quote_currency}")


def get_fresh_rate(db: Session, base_currency: str, quote_currency: str) -> Decimal:
    """Busca la fila de ExchangeRate más reciente para este par; si no existe o está
    stale (más vieja que currency_cache_ttl_hours), refresca on-demand contra el cliente
    correspondiente y guarda una fila nueva. Mismo patrón que expire_on_access de s-rank
    — sin cron, el refresco ocurre en la request que lo necesita.

    base_currency/quote_currency siguen siendo códigos (str) en la firma - la tabla
    ExchangeRate guarda FKs a currencies, pero _fetch_rate_from_client y los clientes de
    tasas (fiat/crypto) siguen operando sobre códigos, así que la resolución a id ocurre
    solo acá, en el borde donde se consulta/inserta la fila."""
    base_id = get_currency_by_code(db, base_currency).id
    quote_id = get_currency_by_code(db, quote_currency).id

    existing = db.scalar(
        select(ExchangeRate)
        .where(ExchangeRate.base_currency_id == base_id, ExchangeRate.quote_currency_id == quote_id)
        .order_by(ExchangeRate.fetched_at.desc())
    )

    if existing is not None:
        fetched_at = existing.fetched_at
        if fetched_at.tzinfo is None:
            fetched_at = fetched_at.replace(tzinfo=timezone.utc)
        max_age = timedelta(hours=settings.currency_cache_ttl_hours)
        if datetime.now(timezone.utc) - fetched_at < max_age:
            return existing.rate

    rate = _fetch_rate_from_client(base_currency, quote_currency)
    row = ExchangeRate(
        base_currency_id=base_id,
        quote_currency_id=quote_id,
        rate=rate,
        fetched_at=datetime.now(timezone.utc),
    )
    db.add(row)
    db.commit()
    return rate
