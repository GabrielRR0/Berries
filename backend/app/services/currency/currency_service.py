from decimal import Decimal

from sqlalchemy.orm import Session

from app.services.currency.rates.cache_refresh import get_fresh_rate


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
