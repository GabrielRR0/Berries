import uuid

from fastapi import status

from app.common.security import CurrentUser, auth_group
from app.database import DbSession
from app.modules.goals import services
from app.modules.goals.contracts.dto import CreateGoalCheckInDto, UpdateGoalCheckInDto
from app.modules.goals.contracts.resources import GoalCheckInResource

router = auth_group()


@router.post("/{goal_id}/check-ins", response_model=GoalCheckInResource, status_code=status.HTTP_201_CREATED)
async def create_check_in(
    goal_id: uuid.UUID, payload: CreateGoalCheckInDto, db: DbSession, user: CurrentUser
) -> GoalCheckInResource:
    check_in = services.record_check_in(
        db,
        goal_id,
        user.id,
        amount_saved=payload.amount_saved,
        new_target_date=payload.new_target_date,
        note=payload.note,
        wallet_id=payload.wallet_id,
    )
    return GoalCheckInResource.model_validate(check_in)


@router.patch("/{goal_id}/check-ins/{check_in_id}", response_model=GoalCheckInResource)
async def update_check_in_endpoint(
    goal_id: uuid.UUID, check_in_id: uuid.UUID, payload: UpdateGoalCheckInDto, db: DbSession, user: CurrentUser
) -> GoalCheckInResource:
    check_in = services.update_check_in(db, goal_id, check_in_id, user.id, wallet_id=payload.wallet_id, note=payload.note)
    return GoalCheckInResource.model_validate(check_in)


@router.get("/{goal_id}/check-ins", response_model=list[GoalCheckInResource])
async def list_check_ins(goal_id: uuid.UUID, db: DbSession, user: CurrentUser) -> list[GoalCheckInResource]:
    return [GoalCheckInResource.model_validate(c) for c in services.list_check_ins_for_goal(db, goal_id, user.id)]
