import uuid
from datetime import datetime

from fastapi import status

from app.common.security import CurrentUser, auth_group
from app.database import DbSession
from app.modules.transactions import services
from app.modules.transactions.contracts.dto import (
    BulkCreateTransactionsDto,
    CreateTransactionDto,
    DuplicateCheckDto,
    UpdateTransactionDto,
)
from app.modules.transactions.contracts.resources import DuplicateCheckResource, TransactionResource

router = auth_group()


@router.post("", response_model=TransactionResource, status_code=status.HTTP_201_CREATED)
async def create(payload: CreateTransactionDto, db: DbSession, user: CurrentUser) -> TransactionResource:
    transaction = services.create_transaction(
        db,
        user.id,
        payload.wallet_id,
        payload.type,
        payload.amount,
        payload.category,
        description=payload.description,
        occurred_at=payload.occurred_at,
        source=payload.source,
        import_key=payload.import_key,
    )
    return TransactionResource.model_validate(transaction)


@router.post("/bulk", response_model=list[TransactionResource], status_code=status.HTTP_201_CREATED)
async def create_bulk(payload: BulkCreateTransactionsDto, db: DbSession, user: CurrentUser) -> list[TransactionResource]:
    transactions = services.create_transactions_bulk(db, user.id, [item.model_dump() for item in payload.items])
    return [TransactionResource.model_validate(t) for t in transactions]


@router.post("/duplicates", response_model=DuplicateCheckResource)
async def check_duplicates(payload: DuplicateCheckDto, db: DbSession, user: CurrentUser) -> DuplicateCheckResource:
    return services.check_duplicates(db, user.id, payload.keys)


@router.get("", response_model=list[TransactionResource])
async def list_mine(
    db: DbSession,
    user: CurrentUser,
    wallet_id: uuid.UUID | None = None,
    category: str | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
) -> list[TransactionResource]:
    transactions = services.list_transactions_for_user(
        db, user.id, wallet_id=wallet_id, category=category, date_from=date_from, date_to=date_to
    )
    return [TransactionResource.model_validate(t) for t in transactions]


@router.patch("/{transaction_id}", response_model=TransactionResource)
async def update(
    transaction_id: uuid.UUID, payload: UpdateTransactionDto, db: DbSession, user: CurrentUser
) -> TransactionResource:
    transaction = services.update_transaction(
        db,
        transaction_id,
        user.id,
        payload.wallet_id,
        payload.type,
        payload.amount,
        payload.category,
        payload.description,
        payload.occurred_at,
    )
    return TransactionResource.model_validate(transaction)


@router.delete("/{transaction_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete(transaction_id: uuid.UUID, db: DbSession, user: CurrentUser) -> None:
    services.delete_transaction(db, transaction_id, user.id)
