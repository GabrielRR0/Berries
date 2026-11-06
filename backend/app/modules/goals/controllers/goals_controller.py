import uuid
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.common.security import get_current_user
from app.database import get_db
from app.modules.auth import User
from app.modules.goals.contracts.dto import CreateGoalCheckInDto, CreateGoalDto, GoalVoicePreviewDto, UpdateGoalCheckInDto, UpdateGoalDto
from app.modules.goals.contracts.enums import Status
from app.modules.goals.contracts.resources import GoalCheckInResource, GoalResource, GoalSavingsCapacityResource, GoalSummaryResource, GoalVoicePreviewResource, PendingCheckInResource, WalletCommitmentResource
from app.modules.goals.services.check_in_service import (
    abandon_goal,
    get_goals_needing_check_in_for_user,
    list_check_ins_for_goal,
    record_check_in,
    update_check_in,
)
from app.modules.currency import UnsupportedCurrencyError
from app.modules.goals.services.contribution_calculator import compute_monthly_contribution
from app.modules.goals.errors import (
    GoalNotActiveError,
    GoalNotFoundError,
    GoalValidationError,
    InsufficientAvailableBalanceError,
)
from app.modules.goals.services.goal_service import (
    build_goal_response,
    create_goal,
    delete_goal,
    get_goal_owned_by_user,
    get_goal_summary,
    get_savings_capacity,
    list_goals_for_user,
    update_goal,
)
from app.modules.goals.services.goal_voice_service import parse_goal_voice_entry
from app.modules.goals.services.wallet_commitment_service import get_committed_amounts_for_user
from app.modules.wallets import CurrencyMismatchError, WalletNotFoundError

router = APIRouter()


@router.post("", response_model=GoalResource, status_code=status.HTTP_201_CREATED)
async def create(
    payload: CreateGoalDto, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
) -> GoalResource:
    try:
        goal = create_goal(
            db,
            user_id=current_user.id,
            title=payload.title,
            target_amount=payload.target_amount,
            currency=payload.currency,
            target_date=payload.target_date,
            goal_type=payload.goal_type,
            initial_amount=payload.initial_amount,
            initial_amount_note=payload.initial_amount_note,
            initial_amount_wallet_id=payload.initial_amount_wallet_id,
        )
    except WalletNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except (GoalValidationError, UnsupportedCurrencyError, CurrencyMismatchError, InsufficientAvailableBalanceError) as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return build_goal_response(goal)


@router.get("", response_model=list[GoalResource])
async def list_mine(
    # alias="status": el parametro Python se llama status_filter (el nombre "status" ya
    # esta tomado por el modulo status de fastapi, importado arriba para los codigos
    # HTTP) pero el query param publico sigue siendo ?status=, igual criterio que
    # ?direction= en debts_router.
    status_filter: Status | None = Query(default=None, alias="status"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[GoalResource]:
    goals = list_goals_for_user(db, current_user.id, status=status_filter)
    return [build_goal_response(goal) for goal in goals]


@router.get("/summary", response_model=GoalSummaryResource)
async def summary(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> GoalSummaryResource:
    totals = get_goal_summary(db, current_user.id)
    return GoalSummaryResource(**totals)


@router.get("/wallet-commitments", response_model=list[WalletCommitmentResource])
async def wallet_commitments(
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
) -> list[WalletCommitmentResource]:
    # Declarado antes de "/{goal_id}" a proposito - mismo motivo que summary/
    # savings-capacity/pending-check-ins de aca abajo (un "/{goal_id}" de un solo
    # segmento los taparia si se registrara antes).
    committed = get_committed_amounts_for_user(db, current_user.id)
    return [
        WalletCommitmentResource(wallet_id=wallet_id, committed_amount=amount)
        for wallet_id, amount in committed.items()
    ]


@router.get("/savings-capacity", response_model=GoalSavingsCapacityResource)
async def savings_capacity(
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
) -> GoalSavingsCapacityResource:
    capacity = get_savings_capacity(db, current_user.id)
    return GoalSavingsCapacityResource(**capacity)


@router.get("/pending-check-ins", response_model=list[PendingCheckInResource])
async def pending_check_ins(
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
) -> list[PendingCheckInResource]:
    today = date.today()
    goals = get_goals_needing_check_in_for_user(db, current_user.id, today)
    return [
        PendingCheckInResource(
            goal_id=goal.id,
            title=goal.title,
            currency=goal.currency,
            target_date=goal.target_date,
            suggested_amount=compute_monthly_contribution(goal.target_amount, goal.total_saved, goal.target_date, today),
        )
        for goal in goals
    ]


@router.get("/{goal_id}", response_model=GoalResource)
async def get_one(
    goal_id: uuid.UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
) -> GoalResource:
    # Declarado DESPUES de los GET de path estatico (summary/savings-capacity/
    # pending-check-ins) a proposito: FastAPI resuelve por orden de registro, un
    # "/{goal_id}" de un solo segmento antes de esos los taparia.
    try:
        goal = get_goal_owned_by_user(db, goal_id, current_user.id)
    except GoalNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return build_goal_response(goal)


@router.post("/voice-preview", response_model=GoalVoicePreviewResource)
async def voice_preview(
    payload: GoalVoicePreviewDto,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> GoalVoicePreviewResource:
    parsed = parse_goal_voice_entry(db, current_user.id, current_user.default_currency, payload.transcript)
    return GoalVoicePreviewResource(
        title=parsed.title,
        amount=parsed.amount,
        amount_is_monthly=parsed.amount_is_monthly,
        currency=parsed.currency,
        target_date=parsed.target_date,
    )


@router.patch("/{goal_id}", response_model=GoalResource)
async def update(
    goal_id: uuid.UUID,
    payload: UpdateGoalDto,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> GoalResource:
    try:
        goal = update_goal(
            db,
            goal_id,
            current_user.id,
            title=payload.title,
            target_amount=payload.target_amount,
            currency=payload.currency,
            target_date=payload.target_date,
        )
    except GoalNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except GoalNotActiveError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    except (GoalValidationError, UnsupportedCurrencyError) as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return build_goal_response(goal)


@router.delete("/{goal_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete(
    goal_id: uuid.UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
) -> None:
    try:
        delete_goal(db, goal_id, current_user.id)
    except GoalNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.post("/{goal_id}/check-ins", response_model=GoalCheckInResource, status_code=status.HTTP_201_CREATED)
async def create_check_in(
    goal_id: uuid.UUID,
    payload: CreateGoalCheckInDto,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> GoalCheckInResource:
    try:
        check_in = record_check_in(
            db,
            goal_id,
            current_user.id,
            amount_saved=payload.amount_saved,
            new_target_date=payload.new_target_date,
            note=payload.note,
            wallet_id=payload.wallet_id,
        )
    except (GoalNotFoundError, WalletNotFoundError) as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except GoalNotActiveError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    except (GoalValidationError, CurrencyMismatchError, InsufficientAvailableBalanceError) as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return GoalCheckInResource.model_validate(check_in)


@router.patch("/{goal_id}/check-ins/{check_in_id}", response_model=GoalCheckInResource)
async def update_check_in_endpoint(
    goal_id: uuid.UUID,
    check_in_id: uuid.UUID,
    payload: UpdateGoalCheckInDto,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> GoalCheckInResource:
    try:
        check_in = update_check_in(
            db,
            goal_id,
            check_in_id,
            current_user.id,
            wallet_id=payload.wallet_id,
            note=payload.note,
        )
    except (GoalNotFoundError, WalletNotFoundError) as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except (CurrencyMismatchError, InsufficientAvailableBalanceError) as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return GoalCheckInResource.model_validate(check_in)


@router.get("/{goal_id}/check-ins", response_model=list[GoalCheckInResource])
async def list_check_ins(
    goal_id: uuid.UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
) -> list[GoalCheckInResource]:
    try:
        check_ins = list_check_ins_for_goal(db, goal_id, current_user.id)
    except GoalNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return [GoalCheckInResource.model_validate(check_in) for check_in in check_ins]


@router.post("/{goal_id}/abandon", response_model=GoalResource)
async def abandon(
    goal_id: uuid.UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
) -> GoalResource:
    try:
        goal = abandon_goal(db, goal_id, current_user.id)
    except GoalNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except GoalNotActiveError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    return build_goal_response(goal)
