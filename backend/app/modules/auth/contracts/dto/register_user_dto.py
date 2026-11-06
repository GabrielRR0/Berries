from pydantic import BaseModel, EmailStr, Field

from app.modules.auth.contracts.dto.wallet_seed_dto import WalletSeedDto


class RegisterUserDto(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    display_name: str | None = Field(default=None, max_length=120)
    # Ambos opcionales - un cliente que solo mande email/password sigue funcionando
    # igual que antes del wizard (default_currency cae en "USD", wallets vacio).
    default_currency: str = Field(default="USD", max_length=10)
    wallets: list[WalletSeedDto] = Field(default_factory=list)
    # Token del widget de Cloudflare Turnstile (ver app/support/turnstile_support/) - solo se
    # exige de verdad cuando TURNSTILE_ENABLED=true, así que queda opcional acá.
    turnstile_token: str | None = None
