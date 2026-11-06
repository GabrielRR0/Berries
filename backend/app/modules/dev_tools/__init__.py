"""Herramientas de desarrollo: usuario demo con datos sembrados (FAKE_DATA_MODE).

Lo único que otros módulos pueden importar (ver app/common/modules/public_api.py).
"""

from typing import TYPE_CHECKING

from app.common.modules import public_api

if TYPE_CHECKING:
    from app.modules.dev_tools.services.demo_seed_service import DEMO_EMAIL, get_or_create_demo_user

__getattr__, __dir__, __all__ = public_api(__name__, __file__)
