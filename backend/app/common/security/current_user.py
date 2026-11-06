import uuid
from typing import TYPE_CHECKING, Annotated

from fastapi import Depends, Header, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.common.security.tokens import InvalidTokenError, decode_access_token

if TYPE_CHECKING:
    from app.modules.auth import User

bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> "User":
    from app.modules.auth import User

    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="No autenticado")

    try:
        user_id = decode_access_token(credentials.credentials)
    except InvalidTokenError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido") from exc

    try:
        user_uuid = uuid.UUID(user_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido") from exc

    user = db.get(User, user_uuid)
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Usuario no encontrado")
    return user


# Para recibir al usuario en un controller: `def list_mine(user: CurrentUser, db: DbSession)`.
# FastAPI resuelve la dependencia una sola vez por request, aunque el grupo del router
# (auth_group) también la declare.
CurrentUser = Annotated["User", Depends(get_current_user)]


def verify_cron_secret(authorization: str | None = Header(default=None)) -> None:
    """Protege un endpoint invocado por Vercel Cron (no por un usuario con cuenta):
    Vercel manda automáticamente `Authorization: Bearer <CRON_SECRET>` en cada request
    de cron cuando esa env var está configurada en el proyecto - ver
    app/modules/currency/controllers/system/. Sin cron_secret configurado (dev local
    sin .env de producción) el endpoint queda inalcanzable en vez de aceptar cualquier
    pedido sin credencial."""
    if not settings.cron_secret:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Cron no configurado")
    if authorization != f"Bearer {settings.cron_secret}":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="No autorizado")
