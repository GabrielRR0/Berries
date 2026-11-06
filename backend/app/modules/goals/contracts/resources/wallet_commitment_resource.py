import uuid
from decimal import Decimal

from pydantic import BaseModel


class WalletCommitmentResource(BaseModel):
    wallet_id: uuid.UUID
    committed_amount: Decimal
