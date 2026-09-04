import uuid
from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class TransactionCreateRequest(BaseModel):
    wallet_id: uuid.UUID
    type: Literal["income", "expense"]
    amount: Decimal = Field(gt=0)
    category: str = Field(min_length=1, max_length=80)
    description: str | None = None
    # Si no se envía, el service usa "ahora" — permite registrar algo que pasó antes.
    occurred_at: datetime | None = None
    source: str = Field(default="manual", max_length=20)


class TransactionUpdateRequest(BaseModel):
    # Mismas reglas que TransactionCreateRequest, sin "source" (no cambia al editar) -
    # pedido explícito del usuario: poder editar wallet_id/monto/categoría/descripción/
    # fecha de un movimiento ya creado. Todos los campos son obligatorios (no un PATCH
    # parcial): el form de edición del frontend siempre manda el estado completo, mismo
    # criterio que GoalUpdateRequest.
    wallet_id: uuid.UUID
    type: Literal["income", "expense"]
    amount: Decimal = Field(gt=0)
    category: str = Field(min_length=1, max_length=80)
    description: str | None = None
    occurred_at: datetime


class TransactionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    wallet_id: uuid.UUID
    type: str
    amount: Decimal
    # Congelado al crear la transacción, ver create_transaction - None si la wallet ya
    # estaba en USD o si la conversión falló en su momento (best-effort).
    reference_amount_usd: Decimal | None
    category: str
    description: str | None
    occurred_at: datetime
    source: str
    transfer_id: uuid.UUID | None
    created_at: datetime


class DraftResponse(BaseModel):
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
    status: str
    created_at: datetime


class DraftConfirmRequest(BaseModel):
    wallet_id: uuid.UUID
    type: Literal["income", "expense"]
    final_amount: Decimal = Field(gt=0)
    final_category: str = Field(min_length=1, max_length=80)
    final_description: str | None = None
