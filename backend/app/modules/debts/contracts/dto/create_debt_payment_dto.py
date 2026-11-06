import uuid
from datetime import date
from decimal import Decimal

from pydantic import BaseModel, Field


class CreateDebtPaymentDto(BaseModel):
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
