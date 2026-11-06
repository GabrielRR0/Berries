"""Análisis: resumen del período, gastos por categoría y comparaciones mensuales.

Lo único que otros módulos pueden importar (ver app/common/modules/public_api.py).
"""

from typing import TYPE_CHECKING

from app.common.modules import public_api

if TYPE_CHECKING:
    from app.modules.analytics.controllers import analytics_routers
    from app.modules.analytics.services import get_monthly_comparison

__getattr__, __dir__, __all__ = public_api(__name__, __file__)
