import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

# "owed_by_user": el usuario debe esto. "owed_to_user": a el usuario se lo deben.
Direction = Literal["owed_by_user", "owed_to_user"]


class DebtCreateRequest(BaseModel):
    counterparty_name: str = Field(max_length=120)
    direction: Direction
    total_amount: Decimal = Field(gt=0)
    currency: str = Field(max_length=10)
    description: str | None = None
    # Si se omite (o es 0), create_debt no genera cuotas: deuda de monto único ("lump sum").
    installment_count: int | None = Field(default=None, gt=0)
    first_due_date: date | None = None
    frequency_days: int = Field(default=30, gt=0)


class InstallmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    debt_id: uuid.UUID
    due_date: date
    amount: Decimal
    status: str
    paid_at: datetime | None


class DebtResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    counterparty_name: str
    direction: str
    total_amount: Decimal
    currency: str
    description: str | None
    created_at: datetime
    installments: list[InstallmentResponse] = []


class DebtSummaryResponse(BaseModel):
    total_owed_by_user: Decimal
    total_owed_to_user: Decimal
