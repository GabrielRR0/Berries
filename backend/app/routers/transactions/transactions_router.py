import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.models.auth.user_model import User
from app.schemas.transactions.transaction_schemas import (
    DraftBulkCreateRequest,
    DraftConfirmRequest,
    DraftConfirmTransferRequest,
    DraftResponse,
    DraftUpdateRequest,
    DuplicateCheckRequest,
    DuplicateCheckResponse,
    TransactionBulkCreateRequest,
    TransactionCreateRequest,
    TransactionResponse,
    TransactionUpdateRequest,
)
from app.services.transactions.drafts.draft_review_service import (
    confirm_draft,
    confirm_draft_as_transfer,
    create_drafts_bulk,
    discard_draft,
    list_drafts_for_user,
    update_draft,
)
from app.services.transactions.errors import DraftNotFoundError, TransactionValidationError
from app.services.currency.errors import UnsupportedCurrencyError
from app.services.wallets.errors import CurrencyMismatchError, InsufficientBalanceError, WalletNotFoundError
from app.services.transactions.transaction_service import (
    create_transaction,
    create_transactions_bulk,
    find_existing_import_keys,
    delete_transaction,
    list_transactions_for_user,
    update_transaction,
)

router = APIRouter()


@router.post("", response_model=TransactionResponse, status_code=status.HTTP_201_CREATED)
async def create(
    payload: TransactionCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TransactionResponse:
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
    return TransactionResponse.model_validate(transaction)


@router.post("/bulk", response_model=list[TransactionResponse], status_code=status.HTTP_201_CREATED)
async def create_bulk(
    payload: TransactionBulkCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[TransactionResponse]:
    try:
        transactions = create_transactions_bulk(db, current_user.id, [item.model_dump() for item in payload.items])
    except TransactionValidationError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return [TransactionResponse.model_validate(t) for t in transactions]


@router.post("/duplicates", response_model=DuplicateCheckResponse)
async def check_duplicates(
    payload: DuplicateCheckRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DuplicateCheckResponse:
    found = find_existing_import_keys(db, current_user.id, payload.keys)
    return DuplicateCheckResponse(duplicates=[key for key in payload.keys if key in found])


@router.get("", response_model=list[TransactionResponse])
async def list_mine(
    wallet_id: uuid.UUID | None = None,
    category: str | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[TransactionResponse]:
    transactions = list_transactions_for_user(
        db, current_user.id, wallet_id=wallet_id, category=category, date_from=date_from, date_to=date_to
    )
    return [TransactionResponse.model_validate(t) for t in transactions]


@router.patch("/{transaction_id}", response_model=TransactionResponse)
async def update(
    transaction_id: uuid.UUID,
    payload: TransactionUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TransactionResponse:
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
    return TransactionResponse.model_validate(transaction)


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


@router.get("/drafts", response_model=list[DraftResponse])
async def list_drafts(
    status_filter: str | None = Query(default="pending", alias="status"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[DraftResponse]:
    drafts = list_drafts_for_user(db, current_user.id, status=status_filter)
    return [DraftResponse.model_validate(d) for d in drafts]


@router.post("/drafts/{draft_id}/confirm", response_model=TransactionResponse)
async def confirm(
    draft_id: uuid.UUID,
    payload: DraftConfirmRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TransactionResponse:
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
    return TransactionResponse.model_validate(transaction)


@router.post("/drafts/bulk", response_model=list[DraftResponse], status_code=status.HTTP_201_CREATED)
async def create_drafts(
    payload: DraftBulkCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[DraftResponse]:
    try:
        drafts = create_drafts_bulk(db, current_user.id, [item.model_dump() for item in payload.items])
    except WalletNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except UnsupportedCurrencyError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return [DraftResponse.model_validate(d) for d in drafts]


@router.patch("/drafts/{draft_id}", response_model=DraftResponse)
async def edit_draft(
    draft_id: uuid.UUID,
    payload: DraftUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DraftResponse:
    try:
        draft = update_draft(db, draft_id, current_user.id, payload.model_dump(exclude_unset=True))
    except DraftNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except WalletNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except (TransactionValidationError, UnsupportedCurrencyError) as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return DraftResponse.model_validate(draft)


@router.post("/drafts/{draft_id}/confirm-transfer", response_model=DraftResponse)
async def confirm_as_transfer(
    draft_id: uuid.UUID,
    payload: DraftConfirmTransferRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DraftResponse:
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
    return DraftResponse.model_validate(draft)


@router.post("/drafts/{draft_id}/discard", response_model=DraftResponse)
async def discard(
    draft_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DraftResponse:
    try:
        draft = discard_draft(db, draft_id, current_user.id)
    except DraftNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return DraftResponse.model_validate(draft)
