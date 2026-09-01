import uuid
from datetime import date
from decimal import Decimal

from sqlalchemy import Date, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.core.encryption import EncryptedDecimal, EncryptedString
from app.models.shared.column_types import CreatedAt, CurrencyFk, DebtFk, NullableWalletFk, UuidPk


class DebtPayment(Base):
    """Un abono/cobro parcial registrado contra una deuda - a diferencia de Installment
    (cuotas de monto fijo planificadas de antemano), esto es plata que se registra
    despues de ocurrir, en cualquier monto y en cualquier momento (ej. "Steven me pagó
    50 USDT" contra una deuda de $500 - pedido explicito del usuario). Coexiste con
    installments sin pisarlos: el saldo restante de una deuda resta ambos (ver
    debt_service.get_debt_paid_amount)."""

    __tablename__ = "debt_payments"

    id: Mapped[UuidPk]
    debt_id: Mapped[DebtFk]
    # Lo que efectivamente se pagó, en su propia moneda (puede ser distinta a la de la
    # deuda). Encriptado, mismo criterio que Debt.total_amount.
    amount: Mapped[Decimal] = mapped_column(EncryptedDecimal, nullable=False)
    currency_id: Mapped[CurrencyFk]
    currency_ref: Mapped["Currency"] = relationship("Currency")

    @property
    def currency(self) -> str:
        return self.currency_ref.code

    # Equivalente aplicado al saldo de la deuda, en la moneda DE LA DEUDA (no la de
    # arriba) - mismo criterio que transfer_service.execute_transfer(converted_amount):
    # sin conversión automática por tasas en vivo, el usuario lo escribe a mano cuando
    # las monedas difieren (ver debt_payment_service.create_debt_payment). Si
    # coinciden, el frontend manda el mismo valor que `amount`.
    applied_amount: Mapped[Decimal] = mapped_column(EncryptedDecimal, nullable=False)
    note: Mapped[str | None] = mapped_column(EncryptedString, nullable=True)
    # Fecha en que ocurrió el pago (la puede mover el usuario) - a diferencia de
    # created_at, que es cuando se guardó la fila.
    paid_at: Mapped[date] = mapped_column(Date, nullable=False)

    # Opcional: si el usuario eligió acreditar/debitar una billetera real al registrar
    # el pago ("sería como un ingreso/gasto de una deuda", pedido explícito), acá
    # queda la wallet afectada y la Transaction real que se generó - ambas nullable
    # porque un pago puede quedar solo como nota de historial, sin tocar ninguna
    # billetera (ver debt_payment_service.create_debt_payment). transaction_id permite
    # que delete_debt_payment revierta el saldo y borre esa fila del ledger, mismo
    # criterio que Transaction.transfer_id en transfer_service.py.
    wallet_id: Mapped[NullableWalletFk]
    transaction_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("transactions.id"), nullable=True, index=True
    )

    created_at: Mapped[CreatedAt]

    debt: Mapped["Debt"] = relationship("Debt", back_populates="payments")
