"""Auditoría de solo lectura: tasas del bolívar y valores de referencia que se apartan de la serie real."""

from dataclasses import dataclass, field
from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.currency.models.exchange_rate_model import ExchangeRate
from app.modules.currency.services.currency_lookup import get_currency_by_code
from app.modules.currency.services.rates import venezuela_rate_client
from app.modules.transactions import Transaction


@dataclass

class RateAudit:
    """Resultado de comparar lo guardado con la serie real del proveedor (ver audit_vef_rates)."""

    bad_rates: list[dict] = field(default_factory=list)
    affected_transactions: list[dict] = field(default_factory=list)

    @property
    def is_clean(self) -> bool:
        return not self.bad_rates and not self.affected_transactions


def audit_vef_rates(db: Session, tolerance: Decimal = Decimal("0.10")) -> RateAudit:
    """Detecta datos de tasa del bolivar que ya esten mal: filas de ExchangeRate y movimientos cuyo valor de
    referencia congelado se aparten mas de `tolerance` (10 % por defecto) de la tasa publicada ese dia por el
    proveedor. Es de solo lectura. Si encuentra algo, la reparacion es borrar la fila mala y correr
    `manage.py backfill:reference-amounts`. Pensado para correrse de vez en cuando (`manage.py check:rates`):
    el chequeo de sensatez al guardar (rate_sanity.py) PREVIENE, esto DETECTA lo que se haya colado.

    Un dia sin dato (fin de semana) se compara con el ultimo dia habil anterior."""
    history = dict(venezuela_rate_client.fetch_vef_rate_history())

    def published_for(day: date) -> Decimal | None:
        for back in range(7):
            value = history.get(day - timedelta(days=back))
            if value is not None:
                return value
        return None

    usd = get_currency_by_code(db, "USD")
    vef = get_currency_by_code(db, "VEF")
    audit = RateAudit()

    for row in db.scalars(select(ExchangeRate).order_by(ExchangeRate.fetched_at)):
        if {row.base_currency_id, row.quote_currency_id} != {usd.id, vef.id}:
            continue
        bs_per_usd = row.rate if row.base_currency_id == usd.id else Decimal("1") / row.rate
        published = published_for(row.fetched_at.date())
        if published is not None and abs(bs_per_usd - published) / published > tolerance:
            audit.bad_rates.append(
                {
                    "id": str(row.id),
                    "fetched_at": row.fetched_at.isoformat(),
                    "bs_per_usd": round(bs_per_usd, 4),
                    "published": published,
                    "source": row.source,
                    "is_estimated": row.is_estimated,
                }
            )

    for transaction in db.scalars(select(Transaction)):
        if transaction.reference_rate is None or transaction.currency != "VEF":
            continue
        published = published_for(transaction.occurred_at.date())
        if published is not None and abs(transaction.reference_rate - published) / published > tolerance:
            audit.affected_transactions.append(
                {
                    "id": str(transaction.id),
                    "occurred_on": transaction.occurred_at.date().isoformat(),
                    "stored_rate": round(transaction.reference_rate, 2),
                    "published": published,
                }
            )
    return audit
