import uuid
from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field


class ConfirmDraftDto(BaseModel):
    wallet_id: uuid.UUID
    type: Literal["income", "expense"]
    final_amount: Decimal = Field(gt=0)
    final_category: str = Field(min_length=1, max_length=80)
    final_description: str | None = None
    # Si no se envia, se usa la fecha que traia el borrador (o "ahora" si no tenia).
    occurred_at: datetime | None = None
    # Comision cobrada junto con el movimiento: se registra como su propio gasto "Comision".
    fee: Decimal | None = Field(default=None, ge=0)
