from decimal import Decimal

from pydantic import BaseModel


class ConversionResponse(BaseModel):
    converted_amount: Decimal
    rate_used: Decimal


class RefreshDailyResponse(BaseModel):
    refreshed_currencies: list[str]
