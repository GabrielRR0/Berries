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


class DebtPaymentCreateRequest(BaseModel):
    # Lo que efectivamente se pagó, en su propia moneda (ver DebtPayment). No tiene
    # por qué coincidir con la moneda de la deuda - ej. deuda en USD, pago en USDT.
    amount: Decimal = Field(gt=0)
    currency: str = Field(max_length=10)
    # Obligatorio SOLO cuando `currency` difiere de la moneda de la deuda (ver
    # debt_payment_service.create_debt_payment - mismo criterio que
    # TransferForm.vue/converted_amount, sin conversión automática por tasas en vivo).
    applied_amount: Decimal | None = Field(default=None, gt=0)
    note: str | None = Field(default=None, max_length=280)
    paid_at: date | None = None
    # Opcional: acredita/debita esta billetera real ademas de quedar en el
    # historial ("sería como un ingreso/gasto de una deuda", pedido explícito).
    wallet_id: uuid.UUID | None = None


class DebtPaymentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    debt_id: uuid.UUID
    amount: Decimal
    currency: str
    applied_amount: Decimal
    note: str | None
    paid_at: date
    wallet_id: uuid.UUID | None
    created_at: datetime


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
    payments: list[DebtPaymentResponse] = []
    # Calculados por debt_service.build_debt_response (no son campos reales del
    # modelo) - cuotas pagadas + abonos registrados, y lo que falta de total_amount.
    amount_paid: Decimal
    remaining_amount: Decimal


class DebtSummaryResponse(BaseModel):
    total_owed_by_user: Decimal
    total_owed_to_user: Decimal


class DebtPaymentVoiceParseRequest(BaseModel):
    transcript: str = Field(min_length=1)


class DebtPaymentVoiceParseResponse(BaseModel):
    # No persiste nada - solo precarga el formulario de "Registrar pago" para que el
    # usuario confirme (ver DebtPaymentVoiceParseRequest/payment_voice_parser.py).
    amount: Decimal | None
    currency: str
    paid_at: date
    note: str
