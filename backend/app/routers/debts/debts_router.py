import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.models.auth.user_model import User
from app.schemas.debts.debt_schemas import (
    Direction,
    DebtCreateRequest,
    DebtResponse,
    DebtSummaryResponse,
    InstallmentResponse,
)
from app.services.debts.debt_service import (
    create_debt,
    delete_debt,
    get_debt_owned_by_user,
    get_debt_summary,
    list_debts_for_user,
)
from app.services.currency.errors import UnsupportedCurrencyError
from app.services.debts.errors import DebtNotFoundError, DebtValidationError, InstallmentAlreadyPaidError
from app.services.debts.installment_service import mark_installment_paid, mark_installment_unpaid

router = APIRouter()


@router.post("", response_model=DebtResponse, status_code=status.HTTP_201_CREATED)
async def create(
    payload: DebtCreateRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
) -> DebtResponse:
    try:
        debt = create_debt(
            db,
            user_id=current_user.id,
            counterparty_name=payload.counterparty_name,
            direction=payload.direction,
            total_amount=payload.total_amount,
            currency=payload.currency,
            description=payload.description,
            installment_count=payload.installment_count,
            first_due_date=payload.first_due_date,
            frequency_days=payload.frequency_days,
        )
    except (DebtValidationError, UnsupportedCurrencyError) as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return DebtResponse.model_validate(debt)


@router.get("", response_model=list[DebtResponse])
async def list_mine(
    direction: Direction | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[DebtResponse]:
    debts = list_debts_for_user(db, current_user.id, direction=direction)
    return [DebtResponse.model_validate(d) for d in debts]


@router.get("/summary", response_model=DebtSummaryResponse)
async def summary(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> DebtSummaryResponse:
    totals = get_debt_summary(db, current_user.id)
    return DebtSummaryResponse(**totals)


@router.delete("/{debt_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete(
    debt_id: uuid.UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
) -> None:
    try:
        delete_debt(db, debt_id, current_user.id)
    except DebtNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.post("/{debt_id}/installments/{installment_id}/pay", response_model=InstallmentResponse)
async def pay(
    debt_id: uuid.UUID,
    installment_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> InstallmentResponse:
    try:
        get_debt_owned_by_user(db, debt_id, current_user.id)
        installment = mark_installment_paid(db, installment_id, current_user.id)
    except DebtNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except InstallmentAlreadyPaidError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    return InstallmentResponse.model_validate(installment)


@router.post("/{debt_id}/installments/{installment_id}/unpay", response_model=InstallmentResponse)
async def unpay(
    debt_id: uuid.UUID,
    installment_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> InstallmentResponse:
    try:
        get_debt_owned_by_user(db, debt_id, current_user.id)
        installment = mark_installment_unpaid(db, installment_id, current_user.id)
    except DebtNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return InstallmentResponse.model_validate(installment)
