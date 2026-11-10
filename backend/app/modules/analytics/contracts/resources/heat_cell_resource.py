from datetime import date
from decimal import Decimal

from pydantic import BaseModel


class HeatCellResource(BaseModel):
    day: date
    total: Decimal
