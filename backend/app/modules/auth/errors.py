from app.common.errors import DomainError


class BetaLimitReachedError(DomainError):
    status_code = 403


class EmailAlreadyRegisteredError(DomainError):
    status_code = 409


class InvalidCredentialsError(DomainError):
    status_code = 401


class HumanCheckFailedError(DomainError):
    """Falta o falló la verificación anti-bots (Cloudflare Turnstile)."""

    status_code = 400


class GoogleLoginError(DomainError):
    """El ID token de Google no es válido, venció o el login con Google no está configurado."""

    status_code = 400
