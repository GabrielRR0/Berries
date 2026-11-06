"""Cuentas: registro, login (contraseña y Google), perfil y borrado de cuenta.

Lo único que otros módulos pueden importar (ver app/common/modules/public_api.py).
"""

from typing import TYPE_CHECKING

from app.common.modules import public_api

if TYPE_CHECKING:
    from app.modules.auth.controllers import auth_routers
    from app.modules.auth.models import User
    from app.modules.auth.services import register_user

__getattr__, __dir__, __all__ = public_api(__name__, __file__)
