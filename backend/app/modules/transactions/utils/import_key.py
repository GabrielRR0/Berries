import hashlib
import hmac
import uuid

from app.config import settings


def seal_import_key(user_id: uuid.UUID, client_key: str) -> str:
    """Identificador de un movimiento importado desde una captura, para no registrarlo
    dos veces. El cliente manda un hash (SHA-256) de los datos del movimiento (billetera,
    monto, fecha, hora, referencia...); aqui se vuelve a firmar con HMAC usando la clave
    maestra y el usuario antes de guardarlo. Asi quien lea la base de datos no puede
    reconstruir montos ni fechas probando valores, y el mismo movimiento de dos usuarios
    distintos nunca coincide."""
    return hmac.new(
        settings.master_encryption_key.encode(),
        f"{user_id}:{client_key}".encode(),
        hashlib.sha256,
    ).hexdigest()
