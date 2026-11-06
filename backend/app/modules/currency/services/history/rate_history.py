"""Serie de tasas guardadas de una moneda, para el gráfico de historial."""

from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.currency.models.exchange_rate_model import ExchangeRate
from app.modules.currency.contracts.resources import RateHistoryPointResource, RateHistoryResource
from app.modules.currency.services.currency_lookup import get_currency_by_code


def get_rate_history(db: Session, code: str, months: int = 6, against: str = "USD") -> list[ExchangeRate]:
    """Serie histórica `against` -> `code` (misma orientación que reference_rate) para
    la página "Tasas" - consulta directa sobre ExchangeRate, que ya es un log
    append-only (nunca se pisa una fila al refrescar, ver cache_refresh.py) - no hace
    falta ninguna tabla nueva. Ascendente por fetched_at.

    `against` por default es "USD" (la tasa oficial/de mercado, ver cache_refresh.py).
    Pasar "USDT" trae en cambio la serie de tasas IMPLÍCITAS reales que el propio
    usuario obtuvo en sus transferencias USDT<->`code` (ver
    transfer_service._record_transfer_rate_observation) - pedido explícito del
    usuario: poder comparar la tasa oficial contra la que él de verdad consigue."""
    against_id = get_currency_by_code(db, against).id
    quote_id = get_currency_by_code(db, code).id
    since = datetime.now(timezone.utc) - timedelta(days=months * 30)
    return list(
        db.scalars(
            select(ExchangeRate)
            .where(
                ExchangeRate.base_currency_id == against_id,
                ExchangeRate.quote_currency_id == quote_id,
                ExchangeRate.fetched_at >= since,
            )
            .order_by(ExchangeRate.fetched_at.asc())
        )
    )


def build_rate_history(db: Session, code: str, months: int, against: str) -> RateHistoryResource:
    """Lo que devuelve GET /currency/history."""
    currency, against_currency = code.upper(), against.upper()
    rows = get_rate_history(db, currency, months, against=against_currency)
    return RateHistoryResource(
        code=currency,
        quote=against_currency,
        points=[
            RateHistoryPointResource(
                fetched_at=row.fetched_at, rate=row.rate, source=row.source, is_estimated=row.is_estimated
            )
            for row in rows
        ],
    )
