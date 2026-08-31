"""Verificación de "Iniciar sesión con Google" (Google Identity Services, ID token) -
pedido explícito del usuario como alternativa a correo/contraseña. Igual criterio que
turnstile.py: sin GOOGLE_CLIENT_ID configurado (el usuario todavía no creó un proyecto
en Google Cloud Console), cualquier intento se rechaza con un error claro en vez de
intentar verificar contra un client id vacío.

Verificación via el endpoint tokeninfo de Google (un GET con httpx, mismo patrón que el
resto de las integraciones externas de este proyecto - Turnstile, OCR) en vez de la
librería oficial google-auth, para no sumar una dependencia nueva. Documentado a
propósito: Google recomienda la librería (verificación local contra su JWKS, sin límite
de tasa) para aplicaciones de alto volumen - tokeninfo alcanza y sobra para una beta
cerrada de 50 usuarios, pero si eso cambia, ahí es donde migrar."""

import httpx

from app.config import settings

_TOKENINFO_URL = "https://oauth2.googleapis.com/tokeninfo"


class GoogleAuthError(Exception):
    pass


class GoogleIdentity:
    def __init__(self, sub: str, email: str, email_verified: bool, name: str | None):
        self.sub = sub
        self.email = email
        self.email_verified = email_verified
        self.name = name


def verify_google_id_token(id_token: str | None) -> GoogleIdentity:
    if not settings.google_client_id:
        raise GoogleAuthError("Login con Google no está configurado")

    if not id_token:
        raise GoogleAuthError("Falta el token de Google")

    response = httpx.get(_TOKENINFO_URL, params={"id_token": id_token}, timeout=10.0)
    if response.status_code != 200:
        raise GoogleAuthError("Token de Google inválido o expirado")

    claims = response.json()

    if claims.get("aud") != settings.google_client_id:
        raise GoogleAuthError("Token de Google no corresponde a esta app")

    email = claims.get("email")
    sub = claims.get("sub")
    if not email or not sub:
        raise GoogleAuthError("Token de Google incompleto")

    return GoogleIdentity(
        sub=sub,
        email=email,
        email_verified=claims.get("email_verified") in ("true", True),
        name=claims.get("name"),
    )
