import uuid
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.wallets.wallet_model import Wallet
from app.services.currency.currency_lookup import get_currency_by_code
from app.services.wallets.errors import WalletNotFoundError


def create_wallet(
    db: Session, user_id: uuid.UUID, name: str, currency: str, initial_balance: Decimal = Decimal("0")
) -> Wallet:
    # initial_balance NO genera una Transaction - es plata que el usuario ya tenia
    # antes de usar Berry, no un ingreso real (no debe sumar en Analisis/Metas).
    currency_row = get_currency_by_code(db, currency)
    wallet = Wallet(user_id=user_id, name=name, currency_id=currency_row.id, balance=initial_balance)
    db.add(wallet)
    db.commit()
    db.refresh(wallet)
    return wallet


def list_wallets_for_user(db: Session, user_id: uuid.UUID) -> list[Wallet]:
    return list(db.scalars(select(Wallet).where(Wallet.user_id == user_id)))


def get_wallet_owned_by_user(db: Session, wallet_id: uuid.UUID, user_id: uuid.UUID) -> Wallet:
    """Nunca revela si un wallet existe pero pertenece a otro usuario: mismo error en
    ambos casos, para no filtrar la existencia de datos ajenos."""
    wallet = db.get(Wallet, wallet_id)
    if wallet is None or wallet.user_id != user_id:
        raise WalletNotFoundError("Billetera no encontrada")
    return wallet


def delete_wallet(db: Session, wallet_id: uuid.UUID, user_id: uuid.UUID) -> None:
    wallet = get_wallet_owned_by_user(db, wallet_id, user_id)
    db.delete(wallet)
    db.commit()
