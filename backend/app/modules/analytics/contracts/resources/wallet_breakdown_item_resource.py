import uuid
from decimal import Decimal

from pydantic import BaseModel


class WalletBreakdownItemResource(BaseModel):
    wallet_id: uuid.UUID
    name: str
    currency: str
    total: Decimal
    percentage: float
    count: int
