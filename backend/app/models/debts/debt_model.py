from decimal import Decimal

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.core.encryption import EncryptedDecimal, EncryptedString
from app.models.shared.column_types import CreatedAt, CurrencyFk, UserFk, UuidPk


class Debt(Base):
    __tablename__ = "debts"

    id: Mapped[UuidPk]
    # Alias de shared/column_types en vez de importar la clase User directo (frontera
    # entre dominios que se construyen en paralelo).
    user_id: Mapped[UserFk]
    # Encriptados (ver app/core/encryption.py) - pedido explicito del usuario: revelan
    # con quien y por cuanto esta endeudado el usuario, exactamente lo que pidio
    # proteger de una lectura directa de la tabla.
    counterparty_name: Mapped[str] = mapped_column(EncryptedString, nullable=False)
    # "owed_by_user": el usuario debe este monto. "owed_to_user": a el usuario se lo deben.
    # SIN encriptar: solo 2 valores fijos, se usa en filtros WHERE (list_debts_for_user).
    direction: Mapped[str] = mapped_column(String(20), nullable=False)
    total_amount: Mapped[Decimal] = mapped_column(EncryptedDecimal, nullable=False)
    # FK a currencies - antes texto libre a proposito (una deuda podia estar en
    # cualquier moneda); pedido explicito del usuario de restringirlo a las mismas
    # monedas que ofrece Billeteras, consistente en toda la app. "currency" como
    # @property (mismo criterio que Wallet.currency) para que DebtResponse.model_
    # validate(debt) siga leyendo un string ahí sin tocar el schema.
    currency_id: Mapped[CurrencyFk]
    currency_ref: Mapped["Currency"] = relationship("Currency")

    @property
    def currency(self) -> str:
        return self.currency_ref.code
    description: Mapped[str | None] = mapped_column(EncryptedString, nullable=True)
    created_at: Mapped[CreatedAt]

    # cascade delete-orphan: borrar la deuda borra sus cuotas (usado por delete_debt).
    installments: Mapped[list["Installment"]] = relationship(
        "Installment", back_populates="debt", cascade="all, delete-orphan", order_by="Installment.due_date"
    )
    # Abonos/cobros parciales (ver DebtPayment) - mismo criterio de cascada que
    # installments: borrar la deuda borra su historial de pagos con ella.
    payments: Mapped[list["DebtPayment"]] = relationship(
        "DebtPayment", back_populates="debt", cascade="all, delete-orphan", order_by="DebtPayment.paid_at.desc()"
    )
