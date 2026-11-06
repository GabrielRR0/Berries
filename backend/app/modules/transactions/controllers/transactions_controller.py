import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.common.security import get_current_user
from app.database import get_db
from app.modules.auth import User
from app.modules.transactions.contracts.dto import BulkCreateDraftsDto, BulkCreateTransactionsDto, ConfirmDraftDto, ConfirmDraftTransferDto, CreateTransactionDto, DuplicateCheckDto, UpdateDraftDto, UpdateTransactionDto
from app.modules.transactions.contracts.resources import DraftResource, DuplicateCheckResource, TransactionResource
from app.modules.transactions.services.drafts.draft_review_service import (
    confirm_draft,
    confirm_draft_as_transfer,
    create_drafts_bulk,
    discard_draft,
    list_drafts_for_user,
    update_draft,
)
from app.modules.transactions.errors import DraftNotFoundError, TransactionValidationError
from app.modules.currency import UnsupportedCurrencyError
from app.modules.wallets import CurrencyMismatchError, InsufficientBalanceError, WalletNotFoundError
from app.modules.transactions.services.transaction_service import (
    create_transaction,
    create_transactions_bulk,
    find_existing_import_keys,
    delete_transaction,
    list_transactions_for_user,
    update_transaction,
)

router = APIRouter()


@router.post("", response_model=TransactionResource, status_code=status.HTTP_201_CREATED)
async def create(
    payload: CreateTransactionDto,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TransactionResource:
    try:
        transaction = create_transaction(
            db,
            current_user.id,
            payload.wallet_id,
            payload.type,
            payload.amount,
            payload.category,
            description=payload.description,
            occurred_at=payload.occurred_at,
            source=payload.source,
            import_key=payload.import_key,
        )
    except TransactionValidationError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return TransactionResource.model_validate(transaction)


@router.post("/bulk", response_model=list[TransactionResource], status_code=status.HTTP_201_CREATED)
async def create_bulk(
    payload: BulkCreateTransactionsDto,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[TransactionResource]:
    try:
        transactions = create_transactions_bulk(db, current_user.id, [item.model_dump() for item in payload.items])
    except TransactionValidationError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return [TransactionResource.model_validate(t) for t in transactions]


@router.post("/duplicates", response_model=DuplicateCheckResource)
async def check_duplicates(
    payload: DuplicateCheckDto,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DuplicateCheckResource:
    found = find_existing_import_keys(db, current_user.id, payload.keys)
    return DuplicateCheckResource(duplicates=[key for key in payload.keys if key in found])


@router.get("", response_model=list[TransactionResource])
async def list_mine(
    wallet_id: uuid.UUID | None = None,
    category: str | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[TransactionResource]:
    transactions = list_transactions_for_user(
        db, current_user.id, wallet_id=wallet_id, category=category, date_from=date_from, date_to=date_to
    )
    return [TransactionResource.model_validate(t) for t in transactions]


@router.patch("/{transaction_id}", response_model=TransactionResource)
async def update(
    transaction_id: uuid.UUID,
    payload: UpdateTransactionDto,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TransactionResource:
    try:
        transaction = update_transaction(
            db,
            transaction_id,
            current_user.id,
            payload.wallet_id,
            payload.type,
            payload.amount,
            payload.category,
            payload.description,
            payload.occurred_at,
        )
    except TransactionValidationError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return TransactionResource.model_validate(transaction)


@router.delete("/{transaction_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete(
    transaction_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    try:
        delete_transaction(db, transaction_id, current_user.id)
    except TransactionValidationError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.get("/drafts", response_model=list[DraftResource])
async def list_drafts(
    status_filter: str | None = Query(default="pending", alias="status"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[DraftResource]:
    drafts = list_drafts_for_user(db, current_user.id, status=status_filter)
    return [DraftResource.model_validate(d) for d in drafts]


@router.post("/drafts/{draft_id}/confirm", response_model=TransactionResource)
async def confirm(
    draft_id: uuid.UUID,
    payload: ConfirmDraftDto,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TransactionResource:
    try:
        transaction, _draft = confirm_draft(
            db,
            draft_id,
            current_user.id,
            payload.wallet_id,
            payload.final_amount,
            payload.final_category,
            payload.final_description,
            payload.type,
            occurred_at=payload.occurred_at,
            fee=payload.fee,
        )
    except DraftNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except TransactionValidationError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return TransactionResource.model_validate(transaction)


@router.post("/drafts/bulk", response_model=list[DraftResource], status_code=status.HTTP_201_CREATED)
async def create_drafts(
    payload: BulkCreateDraftsDto,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[DraftResource]:
    try:
        drafts = create_drafts_bulk(db, current_user.id, [item.model_dump() for item in payload.items])
    except WalletNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except UnsupportedCurrencyError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return [DraftResource.model_validate(d) for d in drafts]


@router.patch("/drafts/{draft_id}", response_model=DraftResource)
async def edit_draft(
    draft_id: uuid.UUID,
    payload: UpdateDraftDto,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DraftResource:
    try:
        draft = update_draft(db, draft_id, current_user.id, payload.model_dump(exclude_unset=True))
    except DraftNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except WalletNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except (TransactionValidationError, UnsupportedCurrencyError) as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return DraftResource.model_validate(draft)


@router.post("/drafts/{draft_id}/confirm-transfer", response_model=DraftResource)
async def confirm_as_transfer(
    draft_id: uuid.UUID,
    payload: ConfirmDraftTransferDto,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DraftResource:
    try:
        draft = confirm_draft_as_transfer(
            db,
            draft_id,
            current_user.id,
            payload.from_wallet_id,
            payload.to_wallet_id,
            payload.sent_amount,
            fee=payload.fee,
            occurred_at=payload.occurred_at,
        )
    except (DraftNotFoundError, WalletNotFoundError) as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except (TransactionValidationError, InsufficientBalanceError, CurrencyMismatchError) as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return DraftResource.model_validate(draft)


@router.post("/drafts/{draft_id}/discard", response_model=DraftResource)
async def discard(
    draft_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DraftResource:
    try:
        draft = discard_draft(db, draft_id, current_user.id)
    except DraftNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return DraftResource.model_validate(draft)
