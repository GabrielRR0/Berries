from decimal import Decimal

from pydantic import BaseModel


class WeekdayAverageResource(BaseModel):
    # 0 = lunes ... 6 = domingo.
    weekday: int
    average: Decimal
