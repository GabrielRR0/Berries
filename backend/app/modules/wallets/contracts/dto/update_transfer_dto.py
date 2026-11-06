from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field


class UpdateTransferDto(BaseModel):
    amount: Decimal = Field(gt=0)
    occurred_at: datetime
    fee: Decimal = Field(default=Decimal("0"), ge=0)
    converted_amount: Decimal | None = Field(default=None, gt=0)
