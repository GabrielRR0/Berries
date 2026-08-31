"""Verificación de Cloudflare Turnstile (anti-bot) - pedido explícito del usuario para
proteger /register y /login de scripts automatizados, además del rate limiting que ya
existe ahí. Carpeta reservada para esto desde antes (ver app/core/README.md), sin nada
construido hasta ahora.

Mientras TURNSTILE_ENABLED sea false (default - el usuario todavía no creó un widget
real en Cloudflare), verify_turnstile() siempre pasa sin llamar a ninguna API externa,
mismo criterio que OCR/tasas de cambio en este proyecto (integración real construida y
lista, pero apagada hasta que exista una key real)."""

import httpx

from app.config import settings

_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"


class TurnstileVerificationError(Exception):
    pass


def verify_turnstile(token: str | None, remote_ip: str | None = None) -> None:
    """No hace nada si TURNSTILE_ENABLED es false. Si está activo, exige un token no
    vacío y lo valida contra la API de Cloudflare - levanta TurnstileVerificationError
    si falta o si Cloudflare lo rechaza (expirado, ya usado, sitio distinto, etc.)."""
    if not settings.turnstile_enabled:
        return

    if not token:
        raise TurnstileVerificationError("Verificación anti-bots requerida")

    payload = {"secret": settings.turnstile_secret_key, "response": token}
    if remote_ip:
        payload["remoteip"] = remote_ip

    response = httpx.post(_VERIFY_URL, data=payload, timeout=10.0)
    response.raise_for_status()
    result = response.json()

    if not result.get("success"):
        raise TurnstileVerificationError("Verificación anti-bots fallida")
