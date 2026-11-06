from datetime import date
from decimal import Decimal

from pydantic import BaseModel, Field

from app.modules.debts.contracts.enums import Direction


class CreateDebtDto(BaseModel):
    counterparty_name: str = Field(max_length=120)
    direction: Direction
    total_amount: Decimal = Field(gt=0)
    currency: str = Field(max_length=10)
    description: str | None = None
    # Si se omite (o es 0), create_debt no genera cuotas: deuda de monto único ("lump sum").
    installment_count: int | None = Field(default=None, gt=0)
    first_due_date: date | None = None
    frequency_days: int = Field(default=30, gt=0)
