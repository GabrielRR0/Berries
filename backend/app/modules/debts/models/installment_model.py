from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Date, DateTime, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.common.crypto import EncryptedDecimal
from app.database.column_types import DebtFk, UuidPk


class Installment(Base):
    __tablename__ = "installments"

    id: Mapped[UuidPk]
    debt_id: Mapped[DebtFk]
    # SIN encriptar: se filtra por rango de fecha (get_due_installments, un futuro cron).
    due_date: Mapped[date] = mapped_column(Date, nullable=False)
    # Encriptado (ver app/common/crypto/encrypted_types.py) - mismo criterio que Debt.total_amount.
    amount: Mapped[Decimal] = mapped_column(EncryptedDecimal, nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # back_populates + relationship (en vez de solo debt_id) para que un futuro cron
    # pueda resolver installment.debt.user_id sin una segunda query manual.
    debt: Mapped["Debt"] = relationship("Debt", back_populates="installments")
