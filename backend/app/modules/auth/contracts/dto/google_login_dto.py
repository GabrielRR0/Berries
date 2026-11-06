from pydantic import BaseModel, Field

from app.modules.auth.contracts.dto.wallet_seed_dto import WalletSeedDto


class GoogleLoginDto(BaseModel):
    # ID token que devuelve Google Identity Services del lado del navegador - ver
    # app/support/google_identity_support/. Sin Turnstile acá a propósito: una cuenta de Google
    # real ya es su propia señal anti-bot, capa redundante sobre otra capa redundante.
    id_token: str
    default_currency: str = Field(default="USD", max_length=10)
    wallets: list[WalletSeedDto] = Field(default_factory=list)
