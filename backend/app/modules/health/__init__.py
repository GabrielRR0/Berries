"""Chequeo de salud de la API.

Lo único que otros módulos pueden importar (ver app/common/modules/public_api.py).
"""

from typing import TYPE_CHECKING

from app.common.modules import public_api

if TYPE_CHECKING:
    from app.modules.health.controllers import health_routers

__getattr__, __dir__, __all__ = public_api(__name__, __file__)
