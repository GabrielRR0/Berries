"""Categorías de movimientos: las por defecto, las propias del usuario y las ocultas.

Lo único que otros módulos pueden importar (ver app/common/modules/public_api.py).
"""

from typing import TYPE_CHECKING

from app.common.modules import public_api

if TYPE_CHECKING:
    from app.modules.categories.models.category_model import Category
    from app.modules.categories.models.hidden_category_model import HiddenCategory
    from app.modules.categories.services.category_service import create_category
    from app.modules.categories.utils.default_categories import DEFAULT_CATEGORIES

__getattr__, __dir__, __all__ = public_api(__name__, __file__)
