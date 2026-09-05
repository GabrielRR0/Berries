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
    # Opcional - "ya tengo $700 si vendo mi laptop" (pedido explicito del usuario).
    # Se guarda como el primer GoalCheckIn de la meta, mismo mecanismo que un aporte
    # normal (ver create_goal), asi el detalle de donde sale la plata queda en su nota.
    initial_amount: Decimal = Field(default=Decimal("0"), ge=0)
    initial_amount_note: str | None = Field(default=None, max_length=500)
    # Opcional - de que billetera sale ese aporte inicial (en vez de "ingreso futuro",
    # pedido explicito del usuario). None = sin enlazar, solo queda la nota de arriba.
    initial_amount_wallet_id: uuid.UUID | None = Field(default=None)


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
    # False mientras la cuenta no lleva al menos 1 mes calendario completo ANTERIOR
    # al actual (ver get_savings_capacity) - pedido explicito del usuario: con una
    # sola cifra (la del mes en curso, todavia ni terminado) no alcanza para llamarlo
    # "promedio" - un gasto puntual de ese unico mes no es un patron mensual real.
    # El front decide si mostrar o no las advertencias de capacidad segun este flag.
    has_enough_history: bool


class GoalCheckInCreateRequest(BaseModel):
    amount_saved: Decimal = Field(ge=0)
    new_target_date: date | None = None
    note: str | None = Field(default=None, max_length=500)
    # Opcional - de que billetera sale este aporte (pedido explicito del usuario, ver
    # GoalCreateRequest.initial_amount_wallet_id). None = "ingreso futuro"/sin enlazar.
    wallet_id: uuid.UUID | None = Field(default=None)


class GoalCheckInResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    goal_id: uuid.UUID
    period_month: date
    amount_saved: Decimal
    previous_target_date: date | None
    new_target_date: date | None
    note: str | None
    wallet_id: uuid.UUID | None
    created_at: datetime


class GoalCheckInUpdateRequest(BaseModel):
    """Edita SOLO la fuente de un aporte ya existente (a que billetera esta enlazado,
    y su nota) - pedido explicito del usuario: "editarlo y decir que los voy a usar de
    mi billetera". Nunca el monto ni la fecha - reemplazo completo de estos 2 campos
    (mismo criterio que GoalUpdateRequest/TransactionUpdateRequest, sin ambiguedad de
    patch parcial)."""

    wallet_id: uuid.UUID | None = None
    note: str | None = Field(default=None, max_length=500)


class WalletCommitmentResponse(BaseModel):
    wallet_id: uuid.UUID
    committed_amount: Decimal


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
