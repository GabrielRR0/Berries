import uuid
from datetime import date
from decimal import Decimal

from pydantic import BaseModel, Field


class CreateGoalCheckInDto(BaseModel):
    amount_saved: Decimal = Field(ge=0)
    new_target_date: date | None = None
    note: str | None = Field(default=None, max_length=500)
    # Opcional - de que billetera sale este aporte (pedido explicito del usuario, ver
    # CreateGoalDto.initial_amount_wallet_id). None = "ingreso futuro"/sin enlazar.
    wallet_id: uuid.UUID | None = Field(default=None)
