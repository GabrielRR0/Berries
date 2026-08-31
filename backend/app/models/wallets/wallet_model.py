from decimal import Decimal

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.core.encryption import EncryptedDecimal
from app.models.shared.column_types import CreatedAt, CurrencyFk, UserFk, UuidPk


class Wallet(Base):
    __tablename__ = "wallets"

    id: Mapped[UuidPk]
    user_id: Mapped[UserFk]
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    # FK a currencies (ver Currency) en vez de string libre - pedido explicito del
    # usuario: una billetera solo puede estar en una de las monedas que la app
    # ofrece, no en cualquier texto (evita typos y monedas inconsistentes entre si).
    # "currency" queda como @property (abajo) que devuelve el código - WalletResponse
    # se arma con model_validate(wallet) (from_attributes=True) y espera un string ahí,
    # igual que antes de este cambio; así ningún schema/router necesita tocarse.
    currency_id: Mapped[CurrencyFk]
    currency_ref: Mapped["Currency"] = relationship("Currency")

    @property
    def currency(self) -> str:
        return self.currency_ref.code
    # Encriptado (ver app/core/encryption.py) - pedido explicito del usuario: ni un
    # admin mirando la tabla directo debe poder ver cuanto tiene un wallet. "default=0"
    # es un default de PYTHON (no server_default): pasa por el TypeDecorator igual que
    # cualquier otro valor, así que el balance inicial también queda encriptado.
    balance: Mapped[Decimal] = mapped_column(EncryptedDecimal, nullable=False, default=Decimal("0"))
    created_at: Mapped[CreatedAt]
