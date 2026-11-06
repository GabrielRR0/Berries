"""Tasa implícita de una transferencia entre monedas distintas (se guarda en ExchangeRate)."""

import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy.orm import Session
from sqlalchemy import select

from app.modules.currency import ExchangeRate
from app.modules.wallets.models.wallet_model import Wallet
from app.modules.wallets.utils.transfer_labels import TRANSFER_RATE_SOURCE


def record_transfer_rate_observation(
    db: Session,
    transfer_id: uuid.UUID,
    from_wallet: Wallet,
    to_wallet: Wallet,
    amount: Decimal,
    credit_amount: Decimal,
    occurred_at: datetime,
) -> None:
    """Congela la tasa IMPLÍCITA real de una transferencia entre monedas distintas
    (ej. cuántos bolívares dieron por USDT ese día/hora) - pedido explícito del
    usuario: "quiero que se guarden este tipo de registros adicionales para
    análisis, de cuánto estaba aprox el usdt ese día y a esa hora". No es una tasa
    de mercado genérica (BCV, Open Exchange Rates...) sino la que el usuario
    obtuvo DE VERDAD en esa operación puntual - más real que cualquier fetch de
    API, así que se guarda con is_estimated=False.

    Usa la MISMA tabla ExchangeRate (ya es un log histórico append-only) en vez de
    una tabla nueva - el par (from.currency, to.currency) es distinto del par que
    usa la tasa oficial (ej. USD/VEF), así que nunca se mezclan ni se pisan entre
    sí. Guarda ambas direcciones, mismo criterio que refresh_all_active_currencies
    en currency/services/. rate = "cuántas unidades de quote equivalen a 1 de
    base" (misma convención que el resto de ExchangeRate).

    transfer_id vincula esta fila con la transferencia que la generó - permite que
    update_transfer la corrija en vez de acumular una nueva cada vez que se edita
    un monto, y que delete_transaction la borre junto con el resto."""
    if amount == 0:
        return
    db.add(
        ExchangeRate(
            base_currency_id=from_wallet.currency_id,
            quote_currency_id=to_wallet.currency_id,
            rate=credit_amount / amount,
            fetched_at=occurred_at,
            source=TRANSFER_RATE_SOURCE,
            is_estimated=False,
            transfer_id=transfer_id,
        )
    )
    if credit_amount != 0:
        db.add(
            ExchangeRate(
                base_currency_id=to_wallet.currency_id,
                quote_currency_id=from_wallet.currency_id,
                rate=amount / credit_amount,
                fetched_at=occurred_at,
                source=TRANSFER_RATE_SOURCE,
                is_estimated=False,
                transfer_id=transfer_id,
            )
        )


def delete_transfer_rate_observations(db: Session, transfer_id: uuid.UUID) -> None:
    for row in db.scalars(select(ExchangeRate).where(ExchangeRate.transfer_id == transfer_id)):
        db.delete(row)
