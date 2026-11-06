import uuid

from fastapi import Query, status

from app.common.security import CurrentUser, auth_group
from app.database import DbSession
from app.modules.transactions import services
from app.modules.transactions.contracts.dto import (
    BulkCreateDraftsDto,
    ConfirmDraftDto,
    ConfirmDraftTransferDto,
    UpdateDraftDto,
)
from app.modules.transactions.contracts.resources import DraftResource, TransactionResource

router = auth_group()


@router.get("/drafts", response_model=list[DraftResource])
async def list_drafts(
    db: DbSession, user: CurrentUser, status_filter: str | None = Query(default="pending", alias="status")
) -> list[DraftResource]:
    return [DraftResource.model_validate(d) for d in services.list_drafts_for_user(db, user.id, status=status_filter)]


@router.post("/drafts/{draft_id}/confirm", response_model=TransactionResource)
async def confirm(draft_id: uuid.UUID, payload: ConfirmDraftDto, db: DbSession, user: CurrentUser) -> TransactionResource:
    transaction, _draft = services.confirm_draft(
        db,
        draft_id,
        user.id,
        payload.wallet_id,
        payload.final_amount,
        payload.final_category,
        payload.final_description,
        payload.type,
        occurred_at=payload.occurred_at,
        fee=payload.fee,
    )
    return TransactionResource.model_validate(transaction)


@router.post("/drafts/bulk", response_model=list[DraftResource], status_code=status.HTTP_201_CREATED)
async def create_drafts(payload: BulkCreateDraftsDto, db: DbSession, user: CurrentUser) -> list[DraftResource]:
    drafts = services.create_drafts_bulk(db, user.id, [item.model_dump() for item in payload.items])
    return [DraftResource.model_validate(d) for d in drafts]


@router.patch("/drafts/{draft_id}", response_model=DraftResource)
async def edit_draft(draft_id: uuid.UUID, payload: UpdateDraftDto, db: DbSession, user: CurrentUser) -> DraftResource:
    draft = services.update_draft(db, draft_id, user.id, payload.model_dump(exclude_unset=True))
    return DraftResource.model_validate(draft)


@router.post("/drafts/{draft_id}/confirm-transfer", response_model=DraftResource)
async def confirm_as_transfer(
    draft_id: uuid.UUID, payload: ConfirmDraftTransferDto, db: DbSession, user: CurrentUser
) -> DraftResource:
    draft = services.confirm_draft_as_transfer(
        db,
        draft_id,
        user.id,
        payload.from_wallet_id,
        payload.to_wallet_id,
        payload.sent_amount,
        fee=payload.fee,
        occurred_at=payload.occurred_at,
    )
    return DraftResource.model_validate(draft)


@router.post("/drafts/{draft_id}/discard", response_model=DraftResource)
async def discard(draft_id: uuid.UUID, db: DbSession, user: CurrentUser) -> DraftResource:
    return DraftResource.model_validate(services.discard_draft(db, draft_id, user.id))
