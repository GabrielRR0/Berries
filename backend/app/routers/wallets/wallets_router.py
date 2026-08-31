import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.models.auth.user_model import User
from app.schemas.wallets.wallet_schemas import TransferRequest, TransferResponse, WalletCreateRequest, WalletResponse
from app.services.currency.errors import UnsupportedCurrencyError
from app.services.wallets.errors import CurrencyMismatchError, InsufficientBalanceError, WalletNotFoundError
from app.services.wallets.transfer_service import execute_transfer
from app.services.wallets.wallet_service import create_wallet, delete_wallet, list_wallets_for_user

router = APIRouter()


@router.post("", response_model=WalletResponse, status_code=status.HTTP_201_CREATED)
async def create(
    payload: WalletCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> WalletResponse:
    try:
        wallet = create_wallet(db, current_user.id, payload.name, payload.currency, payload.initial_balance)
    except UnsupportedCurrencyError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return WalletResponse.model_validate(wallet)


@router.get("", response_model=list[WalletResponse])
async def list_mine(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[WalletResponse]:
    wallets = list_wallets_for_user(db, current_user.id)
    return [WalletResponse.model_validate(wallet) for wallet in wallets]


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


@router.post("/transfer", response_model=TransferResponse)
async def transfer(
    payload: TransferRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TransferResponse:
    try:
        from_wallet, to_wallet = execute_transfer(
            db,
            current_user.id,
            payload.from_wallet_id,
            payload.to_wallet_id,
            payload.amount,
            fee=payload.fee,
            converted_amount=payload.converted_amount,
        )
    except WalletNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except InsufficientBalanceError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except CurrencyMismatchError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    return TransferResponse(
        from_wallet=WalletResponse.model_validate(from_wallet),
        to_wallet=WalletResponse.model_validate(to_wallet),
    )
