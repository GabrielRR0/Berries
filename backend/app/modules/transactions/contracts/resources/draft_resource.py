import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict


class DraftResource(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    source: str
    raw_input: str | None
    parsed_amount: Decimal | None
    parsed_currency: str | None
    parsed_category: str | None
    parsed_description: str | None
    # Solo poblado cuando el dictado menciona una wallet real del usuario junto con una
    # frase de "usé todo el saldo" - ver full_balance_detector.py/voice_entry_service.py.
    suggested_wallet_id: uuid.UUID | None
    # Solo poblados en borradores del registro desde capturas (source="screenshot").
    txn_type: str | None
    occurred_at: datetime | None
    fee: Decimal | None
    reference: str | None
    status: str
    created_at: datetime
