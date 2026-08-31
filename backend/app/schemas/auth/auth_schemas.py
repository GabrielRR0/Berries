import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class WalletSeedRequest(BaseModel):
    """Una billetera a crear junto con la cuenta - ver RegisterWizard.vue paso 2. Mismos
    campos que WalletCreateRequest (wallet_schemas.py), pero se declara aparte porque
    vive dentro de una lista anidada en UserRegisterRequest, no como su propio endpoint."""

    name: str = Field(min_length=1, max_length=120)
    currency: str = Field(min_length=1, max_length=10)
    initial_balance: Decimal = Field(default=Decimal("0"), ge=0)


class UserRegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    display_name: str | None = Field(default=None, max_length=120)
    # Ambos opcionales - un cliente que solo mande email/password sigue funcionando
    # igual que antes del wizard (default_currency cae en "USD", wallets vacio).
    default_currency: str = Field(default="USD", max_length=10)
    wallets: list[WalletSeedRequest] = Field(default_factory=list)
    # Token del widget de Cloudflare Turnstile (ver app/shared/turnstile.py) - solo se
    # exige de verdad cuando TURNSTILE_ENABLED=true, así que queda opcional acá.
    turnstile_token: str | None = None


class UserLoginRequest(BaseModel):
    email: EmailStr
    password: str
    turnstile_token: str | None = None


class GoogleLoginRequest(BaseModel):
    # ID token que devuelve Google Identity Services del lado del navegador - ver
    # app/shared/google_auth.py. Sin Turnstile acá a propósito: una cuenta de Google
    # real ya es su propia señal anti-bot, capa redundante sobre otra capa redundante.
    id_token: str
    default_currency: str = Field(default="USD", max_length=10)
    wallets: list[WalletSeedRequest] = Field(default_factory=list)


class GoogleCheckRequest(BaseModel):
    id_token: str


class GoogleCheckResponse(BaseModel):
    # Usado por LoginForm.vue para decidir, sin crear nada todavia, si "Continuar con
    # Google" debe loguear directo (cuenta existente) o mandar al wizard completo de
    # registro (cuenta nueva, mismo criterio que RegisterWizard: billeteras/moneda
    # antes de crear la cuenta, no solo un login silencioso).
    exists: bool


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    display_name: str | None
    default_currency: str
    created_at: datetime


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse
