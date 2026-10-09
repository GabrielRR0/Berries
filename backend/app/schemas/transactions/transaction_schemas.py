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
    # Hash del movimiento importado desde una captura (ver import_key.py): permite no
    # registrarlo dos veces. Opcional.
    import_key: str | None = Field(default=None, min_length=8, max_length=128)


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
    # Snapshot de la moneda de la wallet al crear/editar (ver transaction_model.py) -
    # None solo en filas viejas que el backfill todavía no alcanzó a rellenar.
    currency: str | None
    # Congelado al crear la transacción, ver create_transaction - None si la wallet ya
    # estaba en USD o si la conversión falló en su momento (best-effort).
    reference_amount_usd: Decimal | None
    # Tasa congelada junto con reference_amount_usd (moneda de la wallet por USD) -
    # mismo criterio de None que arriba.
    reference_rate: Decimal | None
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
    # Solo poblados en borradores del registro desde capturas (source="screenshot").
    txn_type: str | None
    occurred_at: datetime | None
    fee: Decimal | None
    reference: str | None
    status: str
    created_at: datetime


class DraftConfirmRequest(BaseModel):
    wallet_id: uuid.UUID
    type: Literal["income", "expense"]
    final_amount: Decimal = Field(gt=0)
    final_category: str = Field(min_length=1, max_length=80)
    final_description: str | None = None
    # Si no se envia, se usa la fecha que traia el borrador (o "ahora" si no tenia).
    occurred_at: datetime | None = None
    # Comision cobrada junto con el movimiento: se registra como su propio gasto "Comision".
    fee: Decimal | None = Field(default=None, ge=0)


class TransactionBulkCreateRequest(BaseModel):
    # Registro desde una captura con varios movimientos: todo o nada.
    items: list[TransactionCreateRequest] = Field(min_length=1, max_length=100)


class DraftCreateItem(BaseModel):
    source: str = Field(default="screenshot", max_length=10)
    raw_input: str | None = None
    parsed_amount: Decimal = Field(gt=0)
    parsed_currency: str | None = Field(default=None, max_length=10)
    parsed_category: str | None = Field(default=None, max_length=80)
    parsed_description: str | None = None
    suggested_wallet_id: uuid.UUID | None = None
    txn_type: Literal["income", "expense"] | None = None
    occurred_at: datetime | None = None
    fee: Decimal | None = Field(default=None, ge=0)
    reference: str | None = Field(default=None, max_length=60)


class DraftBulkCreateRequest(BaseModel):
    items: list[DraftCreateItem] = Field(min_length=1, max_length=100)


class DraftUpdateRequest(BaseModel):
    # PATCH parcial: solo se aplican los campos enviados (ver update_draft).
    parsed_amount: Decimal | None = Field(default=None, gt=0)
    parsed_currency: str | None = Field(default=None, max_length=10)
    parsed_category: str | None = Field(default=None, max_length=80)
    parsed_description: str | None = None
    suggested_wallet_id: uuid.UUID | None = None
    txn_type: Literal["income", "expense"] | None = None
    occurred_at: datetime | None = None
    fee: Decimal | None = Field(default=None, ge=0)
    reference: str | None = Field(default=None, max_length=60)


class DraftConfirmTransferRequest(BaseModel):
    # El monto del borrador es lo que llego al destino; sent_amount es lo que salio del
    # origen (el dato que faltaba cuando el usuario lo dejo pendiente).
    from_wallet_id: uuid.UUID
    to_wallet_id: uuid.UUID | None = None
    sent_amount: Decimal = Field(gt=0)
    fee: Decimal = Field(default=Decimal("0"), ge=0)
    occurred_at: datetime | None = None


class DuplicateCheckRequest(BaseModel):
    keys: list[str] = Field(max_length=300)


class DuplicateCheckResponse(BaseModel):
    # Las claves enviadas que ya corresponden a un movimiento registrado.
    duplicates: list[str]
