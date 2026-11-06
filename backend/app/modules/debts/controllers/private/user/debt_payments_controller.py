import uuid

from fastapi import status

from app.common.security import CurrentUser, auth_group
from app.database import DbSession
from app.modules.debts import services
from app.modules.debts.contracts.dto import CreateDebtPaymentDto, ParseDebtPaymentVoiceDto
from app.modules.debts.contracts.resources import DebtPaymentResource, DebtPaymentVoiceParseResource

router = auth_group()


@router.post("/{debt_id}/payments", response_model=DebtPaymentResource, status_code=status.HTTP_201_CREATED)
async def add_payment(
    debt_id: uuid.UUID, payload: CreateDebtPaymentDto, db: DbSession, user: CurrentUser
) -> DebtPaymentResource:
    payment = services.create_debt_payment(
        db,
        debt_id,
        user.id,
        amount=payload.amount,
        currency=payload.currency,
        applied_amount=payload.applied_amount,
        note=payload.note,
        paid_at=payload.paid_at,
        wallet_id=payload.wallet_id,
    )
    return DebtPaymentResource.model_validate(payment)


@router.delete("/{debt_id}/payments/{payment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_payment(debt_id: uuid.UUID, payment_id: uuid.UUID, db: DbSession, user: CurrentUser) -> None:
    services.delete_debt_payment(db, debt_id, payment_id, user.id)


@router.post("/{debt_id}/payments/parse-voice", response_model=DebtPaymentVoiceParseResource)
async def parse_payment_voice(
    debt_id: uuid.UUID, payload: ParseDebtPaymentVoiceDto, db: DbSession, user: CurrentUser
) -> DebtPaymentVoiceParseResource:
    parsed = services.parse_debt_payment_transcript(db, debt_id, user.id, payload.transcript)
    return DebtPaymentVoiceParseResource(
        amount=parsed.amount, currency=parsed.currency, paid_at=parsed.paid_at, note=parsed.note
    )
