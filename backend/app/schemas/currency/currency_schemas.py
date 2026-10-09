from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel


class ConversionResponse(BaseModel):
    converted_amount: Decimal
    rate_used: Decimal


class RefreshDailyResponse(BaseModel):
    refreshed_currencies: list[str]


class RateHistoryPoint(BaseModel):
    fetched_at: datetime
    rate: Decimal
    # None en filas viejas, previas a que ExchangeRate guardara procedencia - ver
    # migración 202609210001 y el modelo. La página "Tasas" trata None como "no se sabe"
    # (no como "sí es real"), nunca al revés.
    source: str | None
    is_estimated: bool


class RateHistoryResponse(BaseModel):
    code: str
    quote: str
    points: list[RateHistoryPoint]
