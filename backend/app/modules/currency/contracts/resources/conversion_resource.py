from decimal import Decimal

from pydantic import BaseModel


class ConversionResource(BaseModel):
    converted_amount: Decimal
    rate_used: Decimal
