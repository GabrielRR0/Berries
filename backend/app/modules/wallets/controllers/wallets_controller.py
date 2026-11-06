import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.common.security import get_current_user
from app.database import get_db
from app.modules.auth import User
from app.modules.wallets.contracts.dto import CreateTransferDto, CreateWalletDto, UpdateTransferDto
from app.modules.wallets.contracts.resources import TransferResource, WalletResource
from app.modules.currency import UnsupportedCurrencyError
from app.modules.wallets.errors import (
    CurrencyMismatchError,
    InsufficientBalanceError,
    TransferNotFoundError,
    WalletNotFoundError,
)
from app.modules.wallets.services.transfer_service import execute_transfer, update_transfer
from app.modules.wallets.services.wallet_service import create_wallet, delete_wallet, list_wallets_for_user

router = APIRouter()


@router.post("", response_model=WalletResource, status_code=status.HTTP_201_CREATED)
async def create(
    payload: CreateWalletDto,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> WalletResource:
    try:
        wallet = create_wallet(db, current_user.id, payload.name, payload.currency, payload.initial_balance)
    except UnsupportedCurrencyError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return WalletResource.model_validate(wallet)


@router.get("", response_model=list[WalletResource])
async def list_mine(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[WalletResource]:
    wallets = list_wallets_for_user(db, current_user.id)
    return [WalletResource.model_validate(wallet) for wallet in wallets]


@router.delete("/{wallet_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete(
    wallet_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    try:
        delete_wallet(db, wallet_id, current_user.id)
    except WalletNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.post("/transfer", response_model=TransferResource)
async def transfer(
    payload: CreateTransferDto,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TransferResource:
    try:
        from_wallet, to_wallet = execute_transfer(
            db,
            current_user.id,
            payload.from_wallet_id,
            payload.to_wallet_id,
            payload.amount,
            fee=payload.fee,
            converted_amount=payload.converted_amount,
            occurred_at=payload.occurred_at,
            import_key=payload.import_key,
            note=payload.note,
        )
    except WalletNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except InsufficientBalanceError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except CurrencyMismatchError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    return TransferResource(
        from_wallet=WalletResource.model_validate(from_wallet),
        to_wallet=WalletResource.model_validate(to_wallet),
    )


@router.patch("/transfer/{transfer_id}", response_model=TransferResource)
async def update(
    transfer_id: uuid.UUID,
    payload: UpdateTransferDto,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TransferResource:
    try:
        from_wallet, to_wallet = update_transfer(
            db,
            current_user.id,
            transfer_id,
            payload.amount,
            payload.occurred_at,
            fee=payload.fee,
            converted_amount=payload.converted_amount,
        )
    except TransferNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except InsufficientBalanceError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except CurrencyMismatchError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    return TransferResource(
        from_wallet=WalletResource.model_validate(from_wallet),
        to_wallet=WalletResource.model_validate(to_wallet),
    )
