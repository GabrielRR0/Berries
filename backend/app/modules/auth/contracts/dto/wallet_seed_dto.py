from decimal import Decimal

from pydantic import BaseModel, Field


class WalletSeedDto(BaseModel):
    """Una billetera a crear junto con la cuenta - ver RegisterWizard.vue paso 2. Mismos
    campos que CreateWalletDto (app/modules/wallets/contracts/dto/), pero se declara aparte porque
    vive dentro de una lista anidada en RegisterUserDto, no como su propio endpoint."""

    name: str = Field(min_length=1, max_length=120)
    currency: str = Field(min_length=1, max_length=10)
    initial_balance: Decimal = Field(default=Decimal("0"), ge=0)
