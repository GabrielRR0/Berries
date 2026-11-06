"""Metas de ahorro: aportes, check-ins, capacidad de ahorro y creación por voz.

Lo único que otros módulos pueden importar (ver app/common/modules/public_api.py).
"""

from typing import TYPE_CHECKING

from app.common.modules import public_api

if TYPE_CHECKING:
    from app.modules.goals.controllers import goals_routers
    from app.modules.goals.models import Goal, GoalCheckIn
    from app.modules.goals.services import create_goal, record_check_in

__getattr__, __dir__, __all__ = public_api(__name__, __file__)
