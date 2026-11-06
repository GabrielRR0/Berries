"""Lo que SALE por HTTP: un modelo por respuesta."""

from app.modules.auth.contracts.resources.google_check_resource import GoogleCheckResource
from app.modules.auth.contracts.resources.token_resource import TokenResource
from app.modules.auth.contracts.resources.user_resource import UserResource

__all__ = [
    "GoogleCheckResource",
    "TokenResource",
    "UserResource",
]
