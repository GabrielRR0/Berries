from datetime import date
from decimal import Decimal

from pydantic import BaseModel

from app.modules.analytics.contracts.enums import CompareAgainst
from app.modules.analytics.contracts.resources.category_comparison_item_resource import CategoryComparisonItemResource


class PeriodComparisonResource(BaseModel):
    period: str
    against: CompareAgainst
    # Tramo comparado: los días 1..N del mes (N = días transcurridos si es el mes en curso).
    window_start: date
    window_end: date
    elapsed_days: int
    days_in_month: int
    current_total: Decimal
    previous_total: Decimal
    delta_percent: float | None
    categories: list[CategoryComparisonItemResource]
