from datetime import date
from decimal import Decimal

from pydantic import BaseModel


class TimelineBucketResource(BaseModel):
    # Primer día del período: el día mismo, el lunes de la semana o el día 1 del mes.
    start: date
    total_income: Decimal
    total_expense: Decimal
    net: Decimal
    count: int
