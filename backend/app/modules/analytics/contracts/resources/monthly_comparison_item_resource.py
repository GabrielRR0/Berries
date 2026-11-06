from decimal import Decimal

from pydantic import BaseModel


class MonthlyComparisonItemResource(BaseModel):
    month: str
    total_income: Decimal
    total_expense: Decimal
    net: Decimal
