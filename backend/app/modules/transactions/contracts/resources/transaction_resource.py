import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict


class TransactionResource(BaseModel):
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
