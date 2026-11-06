"""Lo que ENTRA por HTTP: un modelo por caso."""

from app.modules.goals.contracts.dto.create_goal_check_in_dto import CreateGoalCheckInDto
from app.modules.goals.contracts.dto.create_goal_dto import CreateGoalDto
from app.modules.goals.contracts.dto.goal_voice_preview_dto import GoalVoicePreviewDto
from app.modules.goals.contracts.dto.update_goal_check_in_dto import UpdateGoalCheckInDto
from app.modules.goals.contracts.dto.update_goal_dto import UpdateGoalDto

__all__ = [
    "CreateGoalCheckInDto",
    "CreateGoalDto",
    "GoalVoicePreviewDto",
    "UpdateGoalCheckInDto",
    "UpdateGoalDto",
]
