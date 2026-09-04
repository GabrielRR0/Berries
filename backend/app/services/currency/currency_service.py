from datetime import datetime
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.auth.user_model import User
from app.models.currency.currency_model import Currency
from app.models.wallets.wallet_model import Wallet
from app.services.currency.rates.cache_refresh import get_fresh_rate, get_rate_at


def _rate_to_usd(db: Session, currency: str) -> Decimal:
    if currency == "USD":
        return Decimal("1")
    return get_fresh_rate(db, currency, "USD")


def _rate_from_usd(db: Session, currency: str) -> Decimal:
    if currency == "USD":
        return Decimal("1")
    return get_fresh_rate(db, "USD", currency)


def get_conversion_rate(db: Session, from_currency: str, to_currency: str) -> Decimal:
    """Tasa combinada from_currency -> to_currency, siempre pivoteando por USD (incluso
    si uno de los dos ya es USD, en cuyo caso ese tramo es un no-op de valor 1)."""
    if from_currency == to_currency:
        return Decimal("1")
    return _rate_to_usd(db, from_currency) * _rate_from_usd(db, to_currency)


def convert(db: Session, amount: Decimal, from_currency: str, to_currency: str) -> Decimal:
    """Convierte `amount` de from_currency a to_currency. Las tasas se cachean siempre
    relativas a USD como pivote: A -> B pasa por A -> USD -> B (ej. VEF -> EUR obtiene
    VEF/USD y EUR/USD y cruza por USD), nunca por una tasa directa A/B."""
    if from_currency == to_currency:
        return amount
    return amount * get_conversion_rate(db, from_currency, to_currency)


def get_conversion_rate_at(db: Session, from_currency: str, to_currency: str, at: datetime) -> Decimal:
    """Igual que get_conversion_rate, pero resolviendo la tasa que estaba vigente en
    `at` (una fecha pasada), no la de ahora - bug real reportado por el usuario: un
    gasto en una moneda con inflación fuerte (ej. VEF) pierde sentido histórico si
    siempre se reconvierte con la tasa de HOY (3.000 VEF de hace un mes valían más
    dólares que hoy). Usado por analytics_service.py para que un resumen de "los
    últimos N meses" no reescriba el pasado cada vez que la tasa se mueve."""
    if from_currency == to_currency:
        return Decimal("1")
    rate_to_usd = Decimal("1") if from_currency == "USD" else get_rate_at(db, from_currency, "USD", at)
    rate_from_usd = Decimal("1") if to_currency == "USD" else get_rate_at(db, "USD", to_currency, at)
    return rate_to_usd * rate_from_usd


def convert_at(db: Session, amount: Decimal, from_currency: str, to_currency: str, at: datetime) -> Decimal:
    """Igual que convert, pero con la tasa vigente en `at` (una fecha pasada) - ver
    get_conversion_rate_at. Usado por transaction_service.py para congelar el valor de
    referencia en USD de una transacción backdateada con SU propia tasa histórica, no
    la de hoy."""
    if from_currency == to_currency:
        return amount
    return amount * get_conversion_rate_at(db, from_currency, to_currency, at)


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
    dirección como su propia fila de ExchangeRate."""
    wallet_currencies = db.scalars(select(Currency.code).join(Wallet, Wallet.currency_id == Currency.id).distinct())
    user_currencies = db.scalars(select(Currency.code).join(User, User.default_currency_id == Currency.id).distinct())
    codes = sorted((set(wallet_currencies) | set(user_currencies)) - {"USD"})

    for code in codes:
        get_fresh_rate(db, code, "USD")
        get_fresh_rate(db, "USD", code)
    return codes
