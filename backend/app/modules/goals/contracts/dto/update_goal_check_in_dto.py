import uuid

from pydantic import BaseModel, Field

from app.modules.goals.contracts.dto.update_goal_dto import UpdateGoalDto


class UpdateGoalCheckInDto(BaseModel):
    """Edita SOLO la fuente de un aporte ya existente (a que billetera esta enlazado,
    y su nota) - pedido explicito del usuario: "editarlo y decir que los voy a usar de
    mi billetera". Nunca el monto ni la fecha - reemplazo completo de estos 2 campos
    (mismo criterio que UpdateGoalDto/UpdateTransactionDto, sin ambiguedad de
    patch parcial)."""

    wallet_id: uuid.UUID | None = None
    note: str | None = Field(default=None, max_length=500)
