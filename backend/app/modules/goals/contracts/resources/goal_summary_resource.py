from decimal import Decimal

from pydantic import BaseModel


class GoalSummaryResource(BaseModel):
    total_saved: Decimal
    total_target: Decimal
