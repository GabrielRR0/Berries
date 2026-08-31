from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.currency.currency_model import Currency
from app.services.currency.errors import UnsupportedCurrencyError


def get_currency_by_code(db: Session, code: str) -> Currency:
    """Resuelve un código de moneda ("USD", "vef", ...) a su fila de Currency. Punto
    único de resolución para que Wallet/Debt/Goal/User/TransactionDraft (todos FK a
    currencies, no texto libre) validen contra el mismo catálogo sin duplicar la
    consulta en cada service."""
    currency = db.scalar(select(Currency).where(Currency.code == code.upper()))
    if currency is None:
        raise UnsupportedCurrencyError(f"Moneda no soportada: {code}")
    return currency
