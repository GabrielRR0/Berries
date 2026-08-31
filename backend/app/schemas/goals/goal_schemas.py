import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

Status = Literal["active", "completed", "abandoned"]
# Plantillas fijas del paso 1 del alta ("¿Cuál es tu objetivo?") - "custom" es
# "Personalizada" (sin plantilla, solo el titulo que escriba el usuario). Decide que
# icono usa GoalCard.vue/CreateGoalForm.vue - nunca texto libre.
GoalType = Literal["study", "business", "course", "housing", "travel", "vehicle", "computer", "phone", "custom"]


class GoalCreateRequest(BaseModel):
    title: str = Field(max_length=120)
    target_amount: Decimal = Field(gt=0)
    currency: str = Field(max_length=10)
    target_date: date
    goal_type: GoalType = "custom"


class GoalUpdateRequest(BaseModel):
    title: str = Field(max_length=120)
    target_amount: Decimal = Field(gt=0)
    currency: str = Field(max_length=10)
    target_date: date


class GoalResponse(BaseModel):
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


class GoalSummaryResponse(BaseModel):
    total_saved: Decimal
    total_target: Decimal


class GoalSavingsCapacityResponse(BaseModel):
    avg_monthly_income: Decimal
    avg_monthly_expense: Decimal
    avg_monthly_available: Decimal


class GoalCheckInCreateRequest(BaseModel):
    amount_saved: Decimal = Field(ge=0)
    new_target_date: date | None = None
    note: str | None = Field(default=None, max_length=500)


class GoalCheckInResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    goal_id: uuid.UUID
    period_month: date
    amount_saved: Decimal
    previous_target_date: date | None
    new_target_date: date | None
    note: str | None
    created_at: datetime


class PendingCheckInResponse(BaseModel):
    goal_id: uuid.UUID
    title: str
    currency: str
    target_date: date
    suggested_amount: Decimal


class GoalVoicePreviewRequest(BaseModel):
    transcript: str = Field(min_length=1, max_length=2000)


class GoalVoicePreviewResponse(BaseModel):
    title: str | None
    amount: Decimal | None
    amount_is_monthly: bool
    currency: str
    target_date: date | None
