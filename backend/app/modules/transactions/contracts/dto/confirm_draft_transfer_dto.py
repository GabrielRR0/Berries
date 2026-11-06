import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field


class ConfirmDraftTransferDto(BaseModel):
    # El monto del borrador es lo que llego al destino; sent_amount es lo que salio del
    # origen (el dato que faltaba cuando el usuario lo dejo pendiente).
    from_wallet_id: uuid.UUID
    to_wallet_id: uuid.UUID | None = None
    sent_amount: Decimal = Field(gt=0)
    fee: Decimal = Field(default=Decimal("0"), ge=0)
    occurred_at: datetime | None = None
