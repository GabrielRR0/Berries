from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Date, DateTime, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.core.encryption import EncryptedDecimal, EncryptedString
from app.models.shared.column_types import CreatedAt, CurrencyFk, UserFk, UuidPk


class Goal(Base):
    __tablename__ = "goals"

    id: Mapped[UuidPk]
    user_id: Mapped[UserFk]
    # Encriptado (ver app/core/encryption.py) - revela en que quiere gastar/que compra
    # planea el usuario ("MacBook", "TV"), mismo criterio que Debt.counterparty_name.
    title: Mapped[str] = mapped_column(EncryptedString, nullable=False)
    # Encriptado, mismo criterio que Debt.total_amount.
    target_amount: Mapped[Decimal] = mapped_column(EncryptedDecimal, nullable=False)
    # FK a currencies, mismo criterio y mismo pedido del usuario que Debt.currency_id -
    # "currency" como @property (mismo criterio que Wallet.currency).
    currency_id: Mapped[CurrencyFk]
    currency_ref: Mapped["Currency"] = relationship("Currency")

    @property
    def currency(self) -> str:
        return self.currency_ref.code
    # SIN encriptar: se filtra por rango de fecha (check_in_service.get_goals_needing_
    # check_in), mismo criterio que Installment.due_date. Mutable: posponer la meta
    # reescribe este valor (ver check_in_service.record_check_in).
    target_date: Mapped[date] = mapped_column(Date, nullable=False)
    # Encriptado - revela cuanto logro ahorrar el usuario, mismo criterio que
    # Wallet.balance. Total corriente actualizado por cada check-in (record_check_in) -
    # NO se recalcula sumando GoalCheckIn en cada lectura: sumar filas encriptadas en
    # cada render de la lista de metas seria cada vez mas caro con el tiempo (una fila
    # nueva por mes, indefinidamente).
    total_saved: Mapped[Decimal] = mapped_column(EncryptedDecimal, nullable=False, default=Decimal("0"))
    # SIN encriptar: 3 valores fijos usados en filtros WHERE, mismo criterio que
    # Debt.direction. "active" | "completed" | "abandoned".
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="active")
    # SIN encriptar: vocabulario fijo chico (ver GoalType en goal_schemas.py), no texto
    # libre - decide que icono usa GoalCard.vue/CreateGoalForm.vue. "custom" = el
    # usuario no eligio ninguna plantilla, el titulo sigue siendo el unico dato real.
    goal_type: Mapped[str] = mapped_column(String(30), nullable=False, default="custom")
    created_at: Mapped[CreatedAt]
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # cascade delete-orphan: borrar la meta borra su historial de check-ins.
    check_ins: Mapped[list["GoalCheckIn"]] = relationship(
        "GoalCheckIn", back_populates="goal", cascade="all, delete-orphan", order_by="GoalCheckIn.period_month"
    )
