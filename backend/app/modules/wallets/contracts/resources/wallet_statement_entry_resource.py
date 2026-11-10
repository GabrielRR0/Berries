import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel


class WalletStatementEntryResource(BaseModel):
    """Una fila de la cartola: un movimiento de la billetera con el saldo que había
    justo antes y justo después de aplicarlo."""

    id: uuid.UUID
    type: str
    amount: Decimal
    balance_before: Decimal
    balance_after: Decimal
    category: str
    description: str | None
    occurred_at: datetime
    source: str
    transfer_id: uuid.UUID | None
    reference_amount_usd: Decimal | None
