import uuid
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict

from app.modules.goals.contracts.enums import GoalType, Status


class GoalResource(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    title: str
    target_amount: Decimal
    currency: str
    target_date: date
    total_saved: Decimal
    status: Status
    goal_type: GoalType
    created_at: datetime
    completed_at: datetime | None
    # Calculado por goal_service.to_goal_response (no es un campo real del modelo) -
    # cuanto falta reunir por mes, dado target_amount/total_saved/target_date/hoy.
    suggested_monthly_contribution: Decimal
    # Idem, derivado de si el GoalCheckIn mas reciente de esta meta tiene
    # new_target_date poblado - dispara el mensaje motivador en GoalCard.vue.
    last_check_in_postponed: bool
