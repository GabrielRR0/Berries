import uuid
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict


class GoalCheckInResource(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    goal_id: uuid.UUID
    period_month: date
    amount_saved: Decimal
    previous_target_date: date | None
    new_target_date: date | None
    note: str | None
    wallet_id: uuid.UUID | None
    created_at: datetime
