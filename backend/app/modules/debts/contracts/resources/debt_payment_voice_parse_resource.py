from datetime import date
from decimal import Decimal

from pydantic import BaseModel


class DebtPaymentVoiceParseResource(BaseModel):
    # No persiste nada - solo precarga el formulario de "Registrar pago" para que el
    # usuario confirme (ver ParseDebtPaymentVoiceDto/payment_voice_parser.py).
    amount: Decimal | None
    currency: str
    paid_at: date
    note: str
