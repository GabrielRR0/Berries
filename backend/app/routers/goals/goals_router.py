import uuid
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.models.auth.user_model import User
from app.schemas.goals.goal_schemas import (
    GoalCheckInCreateRequest,
    GoalCheckInResponse,
    GoalCheckInUpdateRequest,
    GoalCreateRequest,
    GoalResponse,
    GoalSavingsCapacityResponse,
    GoalSummaryResponse,
    GoalUpdateRequest,
    GoalVoicePreviewRequest,
    GoalVoicePreviewResponse,
    PendingCheckInResponse,
    Status,
    WalletCommitmentResponse,
)
from app.services.goals.check_in_service import (
    abandon_goal,
    get_goals_needing_check_in_for_user,
    list_check_ins_for_goal,
    record_check_in,
    update_check_in,
)
from app.services.currency.errors import UnsupportedCurrencyError
from app.services.goals.contribution_calculator import compute_monthly_contribution
from app.services.goals.errors import (
    GoalNotActiveError,
    GoalNotFoundError,
    GoalValidationError,
    InsufficientAvailableBalanceError,
)
from app.services.goals.goal_service import (
    build_goal_response,
    create_goal,
    delete_goal,
    get_goal_owned_by_user,
    get_goal_summary,
    get_savings_capacity,
    list_goals_for_user,
    update_goal,
)
from app.services.goals.goal_voice_service import parse_goal_voice_entry
from app.services.goals.wallet_commitment_service import get_committed_amounts_for_user
from app.services.wallets.errors import CurrencyMismatchError, WalletNotFoundError

router = APIRouter()


@router.post("", response_model=GoalResponse, status_code=status.HTTP_201_CREATED)
async def create(
    payload: GoalCreateRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
) -> GoalResponse:
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


@router.get("", response_model=list[GoalResponse])
async def list_mine(
    # alias="status": el parametro Python se llama status_filter (el nombre "status" ya
    # esta tomado por el modulo status de fastapi, importado arriba para los codigos
    # HTTP) pero el query param publico sigue siendo ?status=, igual criterio que
    # ?direction= en debts_router.
    status_filter: Status | None = Query(default=None, alias="status"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[GoalResponse]:
    goals = list_goals_for_user(db, current_user.id, status=status_filter)
    return [build_goal_response(goal) for goal in goals]


@router.get("/summary", response_model=GoalSummaryResponse)
async def summary(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> GoalSummaryResponse:
    totals = get_goal_summary(db, current_user.id)
    return GoalSummaryResponse(**totals)


@router.get("/wallet-commitments", response_model=list[WalletCommitmentResponse])
async def wallet_commitments(
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
) -> list[WalletCommitmentResponse]:
    # Declarado antes de "/{goal_id}" a proposito - mismo motivo que summary/
    # savings-capacity/pending-check-ins de aca abajo (un "/{goal_id}" de un solo
    # segmento los taparia si se registrara antes).
    committed = get_committed_amounts_for_user(db, current_user.id)
    return [
        WalletCommitmentResponse(wallet_id=wallet_id, committed_amount=amount)
        for wallet_id, amount in committed.items()
    ]


@router.get("/savings-capacity", response_model=GoalSavingsCapacityResponse)
async def savings_capacity(
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
) -> GoalSavingsCapacityResponse:
    capacity = get_savings_capacity(db, current_user.id)
    return GoalSavingsCapacityResponse(**capacity)


@router.get("/pending-check-ins", response_model=list[PendingCheckInResponse])
async def pending_check_ins(
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
) -> list[PendingCheckInResponse]:
    today = date.today()
    goals = get_goals_needing_check_in_for_user(db, current_user.id, today)
    return [
        PendingCheckInResponse(
            goal_id=goal.id,
            title=goal.title,
            currency=goal.currency,
            target_date=goal.target_date,
            suggested_amount=compute_monthly_contribution(goal.target_amount, goal.total_saved, goal.target_date, today),
        )
        for goal in goals
    ]


@router.get("/{goal_id}", response_model=GoalResponse)
async def get_one(
    goal_id: uuid.UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
) -> GoalResponse:
    # Declarado DESPUES de los GET de path estatico (summary/savings-capacity/
    # pending-check-ins) a proposito: FastAPI resuelve por orden de registro, un
    # "/{goal_id}" de un solo segmento antes de esos los taparia.
    try:
        goal = get_goal_owned_by_user(db, goal_id, current_user.id)
    except GoalNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return build_goal_response(goal)


@router.post("/voice-preview", response_model=GoalVoicePreviewResponse)
async def voice_preview(
    payload: GoalVoicePreviewRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> GoalVoicePreviewResponse:
    parsed = parse_goal_voice_entry(db, current_user.id, current_user.default_currency, payload.transcript)
    return GoalVoicePreviewResponse(
        title=parsed.title,
        amount=parsed.amount,
        amount_is_monthly=parsed.amount_is_monthly,
        currency=parsed.currency,
        target_date=parsed.target_date,
    )


@router.patch("/{goal_id}", response_model=GoalResponse)
async def update(
    goal_id: uuid.UUID,
    payload: GoalUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> GoalResponse:
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


@router.post("/{goal_id}/check-ins", response_model=GoalCheckInResponse, status_code=status.HTTP_201_CREATED)
async def create_check_in(
    goal_id: uuid.UUID,
    payload: GoalCheckInCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> GoalCheckInResponse:
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
    return GoalCheckInResponse.model_validate(check_in)


@router.patch("/{goal_id}/check-ins/{check_in_id}", response_model=GoalCheckInResponse)
async def update_check_in_endpoint(
    goal_id: uuid.UUID,
    check_in_id: uuid.UUID,
    payload: GoalCheckInUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> GoalCheckInResponse:
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
    return GoalCheckInResponse.model_validate(check_in)


@router.get("/{goal_id}/check-ins", response_model=list[GoalCheckInResponse])
async def list_check_ins(
    goal_id: uuid.UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
) -> list[GoalCheckInResponse]:
    try:
        check_ins = list_check_ins_for_goal(db, goal_id, current_user.id)
    except GoalNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return [GoalCheckInResponse.model_validate(check_in) for check_in in check_ins]


@router.post("/{goal_id}/abandon", response_model=GoalResponse)
async def abandon(
    goal_id: uuid.UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
) -> GoalResponse:
    try:
        goal = abandon_goal(db, goal_id, current_user.id)
    except GoalNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except GoalNotActiveError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    return build_goal_response(goal)
