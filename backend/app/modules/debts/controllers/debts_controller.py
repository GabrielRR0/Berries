import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.common.security import get_current_user
from app.database import get_db
from app.modules.auth import User
from app.modules.debts.contracts.dto import CreateDebtDto, CreateDebtPaymentDto, ParseDebtPaymentVoiceDto
from app.modules.debts.contracts.enums import Direction
from app.modules.debts.contracts.resources import DebtPaymentResource, DebtPaymentVoiceParseResource, DebtResource, DebtSummaryResource, InstallmentResource
from app.modules.debts.services.debt_payment_service import create_debt_payment, delete_debt_payment
from app.modules.debts.services.payment_voice_parser import parse_debt_payment_transcript
from app.modules.debts.services.debt_service import (
    build_debt_response,
    create_debt,
    delete_debt,
    get_debt_owned_by_user,
    get_debt_summary,
    list_debts_for_user,
)
from app.modules.currency import UnsupportedCurrencyError
from app.modules.debts.errors import DebtNotFoundError, DebtValidationError, InstallmentAlreadyPaidError
from app.modules.debts.services.installment_service import mark_installment_paid, mark_installment_unpaid
from app.modules.wallets import CurrencyMismatchError, InsufficientBalanceError, WalletNotFoundError

router = APIRouter()


@router.post("", response_model=DebtResource, status_code=status.HTTP_201_CREATED)
async def create(
    payload: CreateDebtDto, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
) -> DebtResource:
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
    return build_debt_response(debt)


@router.get("", response_model=list[DebtResource])
async def list_mine(
    direction: Direction | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[DebtResource]:
    debts = list_debts_for_user(db, current_user.id, direction=direction)
    return [build_debt_response(d) for d in debts]


@router.get("/summary", response_model=DebtSummaryResource)
async def summary(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> DebtSummaryResource:
    totals = get_debt_summary(db, current_user.id)
    return DebtSummaryResource(**totals)


@router.delete("/{debt_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete(
    debt_id: uuid.UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
) -> None:
    try:
        delete_debt(db, debt_id, current_user.id)
    except DebtNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.post("/{debt_id}/installments/{installment_id}/pay", response_model=InstallmentResource)
async def pay(
    debt_id: uuid.UUID,
    installment_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> InstallmentResource:
    try:
        get_debt_owned_by_user(db, debt_id, current_user.id)
        installment = mark_installment_paid(db, installment_id, current_user.id)
    except DebtNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except InstallmentAlreadyPaidError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    return InstallmentResource.model_validate(installment)


@router.post("/{debt_id}/installments/{installment_id}/unpay", response_model=InstallmentResource)
async def unpay(
    debt_id: uuid.UUID,
    installment_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> InstallmentResource:
    try:
        get_debt_owned_by_user(db, debt_id, current_user.id)
        installment = mark_installment_unpaid(db, installment_id, current_user.id)
    except DebtNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return InstallmentResource.model_validate(installment)


@router.post("/{debt_id}/payments", response_model=DebtPaymentResource, status_code=status.HTTP_201_CREATED)
async def add_payment(
    debt_id: uuid.UUID,
    payload: CreateDebtPaymentDto,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DebtPaymentResource:
    try:
        payment = create_debt_payment(
            db,
            debt_id,
            current_user.id,
            amount=payload.amount,
            currency=payload.currency,
            applied_amount=payload.applied_amount,
            note=payload.note,
            paid_at=payload.paid_at,
            wallet_id=payload.wallet_id,
        )
    except (DebtNotFoundError, WalletNotFoundError) as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except (DebtValidationError, UnsupportedCurrencyError, CurrencyMismatchError, InsufficientBalanceError) as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return DebtPaymentResource.model_validate(payment)


@router.delete("/{debt_id}/payments/{payment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_payment(
    debt_id: uuid.UUID,
    payment_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    try:
        delete_debt_payment(db, debt_id, payment_id, current_user.id)
    except DebtNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.post("/{debt_id}/payments/parse-voice", response_model=DebtPaymentVoiceParseResource)
async def parse_payment_voice(
    debt_id: uuid.UUID,
    payload: ParseDebtPaymentVoiceDto,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DebtPaymentVoiceParseResource:
    try:
        parsed = parse_debt_payment_transcript(db, debt_id, current_user.id, payload.transcript)
    except DebtNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return DebtPaymentVoiceParseResource(
        amount=parsed.amount, currency=parsed.currency, paid_at=parsed.paid_at, note=parsed.note
    )
