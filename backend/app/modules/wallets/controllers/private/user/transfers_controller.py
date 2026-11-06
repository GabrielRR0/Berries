import uuid

from app.common.security import CurrentUser, auth_group
from app.database import DbSession
from app.modules.wallets import services
from app.modules.wallets.contracts.dto import CreateTransferDto, UpdateTransferDto
from app.modules.wallets.contracts.resources import TransferResource, WalletResource

router = auth_group()


@router.post("/transfer", response_model=TransferResource)
async def transfer(payload: CreateTransferDto, db: DbSession, user: CurrentUser) -> TransferResource:
    from_wallet, to_wallet = services.execute_transfer(
        db,
        user.id,
        payload.from_wallet_id,
        payload.to_wallet_id,
        payload.amount,
        fee=payload.fee,
        converted_amount=payload.converted_amount,
        occurred_at=payload.occurred_at,
        import_key=payload.import_key,
        note=payload.note,
    )
    return TransferResource(
        from_wallet=WalletResource.model_validate(from_wallet),
        to_wallet=WalletResource.model_validate(to_wallet),
    )


@router.patch("/transfer/{transfer_id}", response_model=TransferResource)
async def update(transfer_id: uuid.UUID, payload: UpdateTransferDto, db: DbSession, user: CurrentUser) -> TransferResource:
    from_wallet, to_wallet = services.update_transfer(
        db,
        user.id,
        transfer_id,
        payload.amount,
        payload.occurred_at,
        fee=payload.fee,
        converted_amount=payload.converted_amount,
    )
    return TransferResource(
        from_wallet=WalletResource.model_validate(from_wallet),
        to_wallet=WalletResource.model_validate(to_wallet),
    )
