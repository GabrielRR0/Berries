import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field


class CreateTransferDto(BaseModel):
    from_wallet_id: uuid.UUID
    to_wallet_id: uuid.UUID
    amount: Decimal = Field(gt=0)
    fee: Decimal = Field(default=Decimal("0"), ge=0)
    # Requerido solo cuando ambos wallets tienen moneda distinta — validado en el service.
    converted_amount: Decimal | None = Field(default=None, gt=0)
    # None = "ahora" (ver execute_transfer) - pedido explicito del usuario: poder
    # backdatear una transferencia igual que un movimiento manual.
    occurred_at: datetime | None = None
    # Hash del movimiento importado desde una captura (ver import_key.py) y una nota libre
    # (ej. la orden P2P y la contraparte) que se agrega a la descripcion de la transferencia.
    import_key: str | None = Field(default=None, min_length=8, max_length=128)
    note: str | None = Field(default=None, max_length=200)
