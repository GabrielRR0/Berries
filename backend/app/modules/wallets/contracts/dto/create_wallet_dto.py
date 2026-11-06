from decimal import Decimal

from pydantic import BaseModel, Field


class CreateWalletDto(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    currency: str = Field(min_length=1, max_length=10)
    # Saldo con el que arranca la billetera - "ya tenia esto antes de usar Berry", no
    # un ingreso real (ver create_wallet: no genera ninguna Transaction).
    initial_balance: Decimal = Field(default=Decimal("0"), ge=0)
