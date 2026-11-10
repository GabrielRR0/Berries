from datetime import date
from decimal import Decimal

from pydantic import BaseModel

from app.modules.analytics.contracts.resources.heat_cell_resource import HeatCellResource
from app.modules.analytics.contracts.resources.weekday_average_resource import WeekdayAverageResource


class SpendingPatternsResource(BaseModel):
    # Primer día de la rejilla (lunes de la semana más antigua) y último día con datos (hoy).
    first_day: date
    last_day: date
    weeks: int
    heat: list[HeatCellResource]
    weekday_averages: list[WeekdayAverageResource]
    daily_average: Decimal
    # Proporción 0-1 del gasto que cae en sábado y domingo.
    weekend_share: float
    busiest_weekday: int | None
    busiest_day: HeatCellResource | None
