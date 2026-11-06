import uuid
from datetime import date
from decimal import Decimal

from pydantic import BaseModel, Field

from app.modules.goals.contracts.enums import GoalType


class CreateGoalDto(BaseModel):
    title: str = Field(max_length=120)
    target_amount: Decimal = Field(gt=0)
    currency: str = Field(max_length=10)
    target_date: date
    goal_type: GoalType = "custom"
    # Opcional - "ya tengo $700 si vendo mi laptop" (pedido explicito del usuario).
    # Se guarda como el primer GoalCheckIn de la meta, mismo mecanismo que un aporte
    # normal (ver create_goal), asi el detalle de donde sale la plata queda en su nota.
    initial_amount: Decimal = Field(default=Decimal("0"), ge=0)
    initial_amount_note: str | None = Field(default=None, max_length=500)
    # Opcional - de que billetera sale ese aporte inicial (en vez de "ingreso futuro",
    # pedido explicito del usuario). None = sin enlazar, solo queda la nota de arriba.
    initial_amount_wallet_id: uuid.UUID | None = Field(default=None)
