from datetime import date
from decimal import Decimal

from sqlalchemy import Date
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.core.encryption import EncryptedDecimal, EncryptedString
from app.models.shared.column_types import CreatedAt, GoalFk, UuidPk


class GoalCheckIn(Base):
    """Fila por cada check-in mensual (o aporte ad-hoc) de una meta. Un check-in que
    ADEMAS posterga la fecha lleva previous_target_date/new_target_date poblados; uno
    normal (solo registra un aporte) los deja en None. Una sola tabla hija en vez de
    dos separadas (check-ins vs postergaciones): postergar SIEMPRE ocurre como parte de
    un check-in, nunca como una accion aislada sin contexto de aporte. Sin restriccion
    UNIQUE en (goal_id, period_month) a proposito: permite mas de un aporte por mes (un
    top-up ad-hoc ademas del check-in mensual) sin forzar "editar la fila del mes"."""

    __tablename__ = "goal_check_ins"

    id: Mapped[UuidPk]
    goal_id: Mapped[GoalFk]
    # SIN encriptar: siempre el dia 1 del mes cubierto, se filtra en WHERE
    # (check_in_service.get_goals_needing_check_in).
    period_month: Mapped[date] = mapped_column(Date, nullable=False)
    # Encriptado, mismo criterio que Installment.amount. Nunca None: "no ahorre nada
    # este mes" se registra como Decimal("0"), no como ausencia de fila.
    amount_saved: Mapped[Decimal] = mapped_column(EncryptedDecimal, nullable=False)
    # SIN encriptar: son fechas de calendario, no revelan monto ni comportamiento de
    # gasto - se necesitan legibles para derivar si el ultimo check-in de una meta
    # poospuso (GoalResponse.last_check_in_postponed) sin desencriptar nada. Ambas None
    # si este check-in no poospuso la meta.
    previous_target_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    new_target_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    # Encriptado (opcional) - texto libre que el usuario puede escribir al posponer,
    # mismo criterio que Debt.description.
    note: Mapped[str | None] = mapped_column(EncryptedString, nullable=True)
    created_at: Mapped[CreatedAt]

    goal: Mapped["Goal"] = relationship("Goal", back_populates="check_ins")
