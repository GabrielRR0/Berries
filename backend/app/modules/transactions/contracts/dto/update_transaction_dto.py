import uuid
from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field


class UpdateTransactionDto(BaseModel):
    # Mismas reglas que CreateTransactionDto, sin "source" (no cambia al editar) -
    # pedido explícito del usuario: poder editar wallet_id/monto/categoría/descripción/
    # fecha de un movimiento ya creado. Todos los campos son obligatorios (no un PATCH
    # parcial): el form de edición del frontend siempre manda el estado completo, mismo
    # criterio que UpdateGoalDto.
    wallet_id: uuid.UUID
    type: Literal["income", "expense"]
    amount: Decimal = Field(gt=0)
    category: str = Field(min_length=1, max_length=80)
    description: str | None = None
    occurred_at: datetime
