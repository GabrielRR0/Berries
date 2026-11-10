import uuid

from fastapi import status

from app.common.security import CurrentUser, auth_group
from app.database import DbSession
from app.modules.wallets import services
from app.modules.wallets.contracts.dto import CreateWalletDto
from app.modules.wallets.contracts.resources import WalletResource, WalletStatementResource

router = auth_group()


@router.post("", response_model=WalletResource, status_code=status.HTTP_201_CREATED)
async def create(payload: CreateWalletDto, db: DbSession, user: CurrentUser) -> WalletResource:
    wallet = services.create_wallet(db, user.id, payload.name, payload.currency, payload.initial_balance)
    return WalletResource.model_validate(wallet)


@router.get("", response_model=list[WalletResource])
async def list_mine(db: DbSession, user: CurrentUser) -> list[WalletResource]:
    return [WalletResource.model_validate(wallet) for wallet in services.list_wallets_for_user(db, user.id)]


@router.get("/{wallet_id}/statement", response_model=WalletStatementResource)
async def statement(wallet_id: uuid.UUID, db: DbSession, user: CurrentUser) -> WalletStatementResource:
    return services.get_wallet_statement(db, wallet_id, user.id)


@router.delete("/{wallet_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete(wallet_id: uuid.UUID, db: DbSession, user: CurrentUser) -> None:
    services.delete_wallet(db, wallet_id, user.id)
