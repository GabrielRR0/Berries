import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class WalletCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    currency: str = Field(min_length=1, max_length=10)
    # Saldo con el que arranca la billetera - "ya tenia esto antes de usar Berry", no
    # un ingreso real (ver create_wallet: no genera ninguna Transaction).
    initial_balance: Decimal = Field(default=Decimal("0"), ge=0)


class WalletResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    currency: str
    balance: Decimal
    created_at: datetime


class TransferRequest(BaseModel):
    from_wallet_id: uuid.UUID
    to_wallet_id: uuid.UUID
    amount: Decimal = Field(gt=0)
    fee: Decimal = Field(default=Decimal("0"), ge=0)
    # Requerido solo cuando ambos wallets tienen moneda distinta — validado en el service.
    converted_amount: Decimal | None = Field(default=None, gt=0)


class TransferResponse(BaseModel):
    from_wallet: WalletResponse
    to_wallet: WalletResponse
