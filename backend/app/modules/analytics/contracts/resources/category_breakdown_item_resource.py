from decimal import Decimal

from pydantic import BaseModel


class CategoryBreakdownItemResource(BaseModel):
    category: str
    total: Decimal
    # 0-100, participación de esta categoría sobre el total de su type+month. 0.0
    # (nunca división por cero) cuando el total del período es 0.
    percentage: float
