import uuid
from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field


class CreateTransactionDto(BaseModel):
    wallet_id: uuid.UUID
    type: Literal["income", "expense"]
    amount: Decimal = Field(gt=0)
    category: str = Field(min_length=1, max_length=80)
    description: str | None = None
    # Si no se envía, el service usa "ahora" — permite registrar algo que pasó antes.
    occurred_at: datetime | None = None
    source: str = Field(default="manual", max_length=20)
    # Hash del movimiento importado desde una captura (ver import_key.py): permite no
    # registrarlo dos veces. Opcional.
    import_key: str | None = Field(default=None, min_length=8, max_length=128)
