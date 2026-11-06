"""Token de sesión (JWT) que el frontend manda en `Authorization: Bearer ...`."""

from datetime import datetime, timedelta, timezone

from app.config import settings
from app.support import jwt_support


class InvalidTokenError(Exception):
    pass


def create_access_token(subject: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_access_token_expire_minutes)
    payload = {"sub": subject, "exp": expire}
    return jwt_support.encode(payload, settings.jwt_secret, settings.jwt_algorithm)


def decode_access_token(token: str) -> str:
    """Devuelve el `sub` (user id) del token, o lanza InvalidTokenError."""
    try:
        payload = jwt_support.decode(token, settings.jwt_secret, settings.jwt_algorithm)
    except jwt_support.JwtError as exc:
        raise InvalidTokenError(str(exc)) from exc

    subject = payload.get("sub")
    if subject is None:
        raise InvalidTokenError("token sin `sub`")
    return subject
