"""Rutas fijas de metas (resúmenes y ayudas). Se registran antes que `/{goal_id}`, que
si no las taparía."""

from datetime import date

from app.common.security import CurrentUser, auth_group
from app.database import DbSession
from app.modules.goals import services
from app.modules.goals.contracts.dto import GoalVoicePreviewDto
from app.modules.goals.contracts.resources import (
    GoalSavingsCapacityResource,
    GoalSummaryResource,
    GoalVoicePreviewResource,
    PendingCheckInResource,
    WalletCommitmentResource,
)

router = auth_group()


@router.get("/summary", response_model=GoalSummaryResource)
async def summary(db: DbSession, user: CurrentUser) -> GoalSummaryResource:
    return GoalSummaryResource(**services.get_goal_summary(db, user.id))


@router.get("/wallet-commitments", response_model=list[WalletCommitmentResource])
async def wallet_commitments(db: DbSession, user: CurrentUser) -> list[WalletCommitmentResource]:
    return services.list_wallet_commitments(db, user.id)


@router.get("/savings-capacity", response_model=GoalSavingsCapacityResource)
async def savings_capacity(db: DbSession, user: CurrentUser) -> GoalSavingsCapacityResource:
    return GoalSavingsCapacityResource(**services.get_savings_capacity(db, user.id))


@router.get("/pending-check-ins", response_model=list[PendingCheckInResource])
async def pending_check_ins(db: DbSession, user: CurrentUser) -> list[PendingCheckInResource]:
    return services.list_pending_check_ins(db, user.id, date.today())


@router.post("/voice-preview", response_model=GoalVoicePreviewResource)
async def voice_preview(payload: GoalVoicePreviewDto, db: DbSession, user: CurrentUser) -> GoalVoicePreviewResource:
    return services.preview_goal_from_voice(db, user.id, user.default_currency, payload.transcript)
