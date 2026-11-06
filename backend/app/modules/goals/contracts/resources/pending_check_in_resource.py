import uuid
from datetime import date
from decimal import Decimal

from pydantic import BaseModel


class PendingCheckInResource(BaseModel):
    goal_id: uuid.UUID
    title: str
    currency: str
    target_date: date
    suggested_amount: Decimal
