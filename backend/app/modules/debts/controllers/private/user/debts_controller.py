import uuid

from fastapi import status

from app.common.security import CurrentUser, auth_group
from app.database import DbSession
from app.modules.debts import services
from app.modules.debts.contracts.dto import CreateDebtDto
from app.modules.debts.contracts.enums import Direction
from app.modules.debts.contracts.resources import DebtResource, DebtSummaryResource

router = auth_group()


@router.post("", response_model=DebtResource, status_code=status.HTTP_201_CREATED)
async def create(payload: CreateDebtDto, db: DbSession, user: CurrentUser) -> DebtResource:
    debt = services.create_debt(
        db,
        user_id=user.id,
        counterparty_name=payload.counterparty_name,
        direction=payload.direction,
        total_amount=payload.total_amount,
        currency=payload.currency,
        description=payload.description,
        installment_count=payload.installment_count,
        first_due_date=payload.first_due_date,
        frequency_days=payload.frequency_days,
    )
    return services.build_debt_response(debt)


@router.get("", response_model=list[DebtResource])
async def list_mine(db: DbSession, user: CurrentUser, direction: Direction | None = None) -> list[DebtResource]:
    return [services.build_debt_response(d) for d in services.list_debts_for_user(db, user.id, direction=direction)]


@router.get("/summary", response_model=DebtSummaryResource)
async def summary(db: DbSession, user: CurrentUser) -> DebtSummaryResource:
    return DebtSummaryResource(**services.get_debt_summary(db, user.id))


@router.delete("/{debt_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete(debt_id: uuid.UUID, db: DbSession, user: CurrentUser) -> None:
    services.delete_debt(db, debt_id, user.id)
