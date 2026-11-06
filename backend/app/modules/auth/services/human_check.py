"""Verificación anti-bots (Cloudflare Turnstile) de registro y login."""

from app.modules.auth.errors import HumanCheckFailedError
from app.support.turnstile_support import TurnstileVerificationError, verify_turnstile


def verify_human(token: str | None, client_ip: str | None) -> None:
    """No hace nada si Turnstile está apagado (ver app/support/turnstile_support)."""
    try:
        verify_turnstile(token, client_ip)
    except TurnstileVerificationError as exc:
        raise HumanCheckFailedError(str(exc)) from exc
