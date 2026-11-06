from datetime import date
from decimal import Decimal

from pydantic import BaseModel, Field


class UpdateGoalDto(BaseModel):
    title: str = Field(max_length=120)
    target_amount: Decimal = Field(gt=0)
    currency: str = Field(max_length=10)
    target_date: date
