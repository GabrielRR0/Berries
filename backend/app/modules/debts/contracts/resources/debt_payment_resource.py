import uuid
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict


class DebtPaymentResource(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    debt_id: uuid.UUID
    amount: Decimal
    currency: str
    applied_amount: Decimal
    note: str | None
    paid_at: date
    wallet_id: uuid.UUID | None
    created_at: datetime
