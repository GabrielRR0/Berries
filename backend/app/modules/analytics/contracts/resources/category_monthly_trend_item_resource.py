from decimal import Decimal

from pydantic import BaseModel


class CategoryMonthlyTrendItemResource(BaseModel):
    category: str
    # Un total por cada mes de `CategoryMonthlyTrendResource.months`, mismo orden y
    # misma cantidad (nunca se omite un mes sin movimientos - queda en 0).
    monthly_totals: list[Decimal]
