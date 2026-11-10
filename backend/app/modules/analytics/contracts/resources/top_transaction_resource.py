import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel


class TopTransactionResource(BaseModel):
    id: uuid.UUID
    occurred_at: datetime
    category: str
    description: str | None
    wallet_name: str
    # Convertido a la moneda por defecto del usuario, igual que el resto de Análisis.
    amount: Decimal
