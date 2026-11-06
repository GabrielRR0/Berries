import uuid
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict


class InstallmentResource(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    debt_id: uuid.UUID
    due_date: date
    amount: Decimal
    status: str
    paid_at: datetime | None
