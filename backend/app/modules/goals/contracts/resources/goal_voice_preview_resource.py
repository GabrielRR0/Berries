from datetime import date
from decimal import Decimal

from pydantic import BaseModel


class GoalVoicePreviewResource(BaseModel):
    title: str | None
    amount: Decimal | None
    amount_is_monthly: bool
    currency: str
    target_date: date | None
