"""Refresco diario de las tasas de todas las monedas en uso (lo dispara el cron de Vercel)."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.auth import User
from app.modules.currency.models.currency_model import Currency
from app.modules.currency.services.history.vef_history import backfill_historical_vef_rates
from app.modules.currency.services.rates.cache_refresh import get_fresh_rate
from app.modules.wallets import Wallet


def refresh_all_active_currencies(db: Session) -> list[str]:
    """Refresca (o confirma vigente, según currency_cache_ttl_hours) la tasa USD<->X de
    cada moneda que la app realmente usa hoy - las que tiene alguna wallet o el
    default_currency de algún usuario. get_fresh_rate ya resuelve la tasa on-demand
    cuando alguien la necesita (crea un movimiento, entra a Análisis...), pero si nadie
    visita la app un día entero ese día no queda ninguna tasa registrada - pedido
    explícito del usuario ("una vez al día... si nadie entró un día se actualiza").
    Pensado para que lo llame el cron diario de Vercel (ver cron_router.py), nunca un
    usuario final.

    Refresca ambas direcciones (código->USD y USD->código) porque get_conversion_rate
    pivotea siempre por USD (ver _rate_to_usd/_rate_from_usd arriba) y cachea cada
    dirección como su propia fila de ExchangeRate.

    Si VEF está entre las monedas activas, también corre backfill_historical_vef_rates
    - autocura cualquier hueco en el histórico (ej. si el cron no llegó a correr un
    día) usando la serie real de dolarapi.com, no una tasa de HOY retroactiva."""
    wallet_currencies = db.scalars(select(Currency.code).join(Wallet, Wallet.currency_id == Currency.id).distinct())
    user_currencies = db.scalars(select(Currency.code).join(User, User.default_currency_id == Currency.id).distinct())
    codes = sorted((set(wallet_currencies) | set(user_currencies)) - {"USD"})

    for code in codes:
        get_fresh_rate(db, code, "USD")
        get_fresh_rate(db, "USD", code)

    if "VEF" in codes:
        backfill_historical_vef_rates(db)

    return codes
