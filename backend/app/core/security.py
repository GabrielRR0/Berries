import hashlib
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt

from app.config import settings


def _bcrypt_input(password: str) -> bytes:
    """bcrypt solo usa los primeros 72 BYTES de la contraseña y descarta el resto en
    silencio (sin error) - verificado a mano: dos contraseñas que comparten esos 72
    bytes iniciales y difieren después verifican como iguales. Como
    UserRegisterRequest permite hasta 128 caracteres, y un caracter UTF-8 puede ocupar
    más de 1 byte, esto podía dejar la mitad de una contraseña larga sin ningún efecto
    real sobre la seguridad. Se resuelve pre-hasheando con SHA-256 (32 bytes fijos,
    siempre dentro del límite de bcrypt) para que la entropía completa de la
    contraseña, sin importar su largo, siga importando."""
    return hashlib.sha256(password.encode("utf-8")).digest()


def hash_password(password: str) -> str:
    return bcrypt.hashpw(_bcrypt_input(password), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(_bcrypt_input(password), hashed.encode("utf-8"))


def create_access_token(subject: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_access_token_expire_minutes)
    payload = {"sub": subject, "exp": expire}
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


class InvalidTokenError(Exception):
    pass


def decode_access_token(token: str) -> str:
    """Devuelve el `sub` (user id) del token, o lanza InvalidTokenError."""
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except jwt.PyJWTError as exc:
        raise InvalidTokenError(str(exc)) from exc

    subject = payload.get("sub")
    if subject is None:
        raise InvalidTokenError("token sin `sub`")
    return subject
