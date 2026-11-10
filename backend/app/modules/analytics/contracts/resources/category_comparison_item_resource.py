from decimal import Decimal

from pydantic import BaseModel


class CategoryComparisonItemResource(BaseModel):
    category: str
    current: Decimal
    previous: Decimal
    # None cuando no hay base de comparación (previous == 0).
    delta_percent: float | None
