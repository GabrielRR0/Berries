"""Metas de ahorro: aportes, check-ins, capacidad de ahorro y creación por voz.

Lo único que otros módulos pueden importar (ver app/common/modules/public_api.py).
"""

from typing import TYPE_CHECKING

from app.common.modules import public_api

if TYPE_CHECKING:
    from app.modules.goals.models.goal_check_in_model import GoalCheckIn
    from app.modules.goals.models.goal_model import Goal
    from app.modules.goals.services.check_in_service import record_check_in
    from app.modules.goals.services.goal_service import create_goal

__getattr__, __dir__, __all__ = public_api(__name__, __file__)
