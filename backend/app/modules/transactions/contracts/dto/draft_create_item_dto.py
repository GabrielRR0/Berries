import uuid
from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field


class DraftCreateItemDto(BaseModel):
    source: str = Field(default="screenshot", max_length=10)
    raw_input: str | None = None
    parsed_amount: Decimal = Field(gt=0)
    parsed_currency: str | None = Field(default=None, max_length=10)
    parsed_category: str | None = Field(default=None, max_length=80)
    parsed_description: str | None = None
    suggested_wallet_id: uuid.UUID | None = None
    txn_type: Literal["income", "expense"] | None = None
    occurred_at: datetime | None = None
    fee: Decimal | None = Field(default=None, ge=0)
    reference: str | None = Field(default=None, max_length=60)
