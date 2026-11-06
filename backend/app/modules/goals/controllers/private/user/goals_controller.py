import uuid

from fastapi import Query, status

from app.common.security import CurrentUser, auth_group
from app.database import DbSession
from app.modules.goals import services
from app.modules.goals.contracts.dto import CreateGoalDto, UpdateGoalDto
from app.modules.goals.contracts.enums import Status
from app.modules.goals.contracts.resources import GoalResource

router = auth_group()


@router.post("", response_model=GoalResource, status_code=status.HTTP_201_CREATED)
async def create(payload: CreateGoalDto, db: DbSession, user: CurrentUser) -> GoalResource:
    goal = services.create_goal(
        db,
        user_id=user.id,
        title=payload.title,
        target_amount=payload.target_amount,
        currency=payload.currency,
        target_date=payload.target_date,
        goal_type=payload.goal_type,
        initial_amount=payload.initial_amount,
        initial_amount_note=payload.initial_amount_note,
        initial_amount_wallet_id=payload.initial_amount_wallet_id,
    )
    return services.build_goal_response(goal)


@router.get("", response_model=list[GoalResource])
async def list_mine(
    db: DbSession,
    user: CurrentUser,
    # alias="status": el parametro Python se llama status_filter (el nombre "status" ya
    # esta tomado por el modulo status de fastapi, importado arriba para los codigos
    # HTTP) pero el query param publico sigue siendo ?status=, igual criterio que
    # ?direction= en debts.
    status_filter: Status | None = Query(default=None, alias="status"),
) -> list[GoalResource]:
    return [services.build_goal_response(goal) for goal in services.list_goals_for_user(db, user.id, status=status_filter)]


@router.get("/{goal_id}", response_model=GoalResource)
async def get_one(goal_id: uuid.UUID, db: DbSession, user: CurrentUser) -> GoalResource:
    return services.build_goal_response(services.get_goal_owned_by_user(db, goal_id, user.id))


@router.patch("/{goal_id}", response_model=GoalResource)
async def update(goal_id: uuid.UUID, payload: UpdateGoalDto, db: DbSession, user: CurrentUser) -> GoalResource:
    goal = services.update_goal(
        db,
        goal_id,
        user.id,
        title=payload.title,
        target_amount=payload.target_amount,
        currency=payload.currency,
        target_date=payload.target_date,
    )
    return services.build_goal_response(goal)


@router.delete("/{goal_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete(goal_id: uuid.UUID, db: DbSession, user: CurrentUser) -> None:
    services.delete_goal(db, goal_id, user.id)


@router.post("/{goal_id}/abandon", response_model=GoalResource)
async def abandon(goal_id: uuid.UUID, db: DbSession, user: CurrentUser) -> GoalResource:
    return services.build_goal_response(services.abandon_goal(db, goal_id, user.id))
