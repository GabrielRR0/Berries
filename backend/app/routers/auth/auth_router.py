from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.core.rate_limit import get_client_ip, limiter
from app.core.security import create_access_token
from app.models.auth.user_model import User
from app.schemas.auth.auth_schemas import (
    GoogleCheckRequest,
    GoogleCheckResponse,
    GoogleLoginRequest,
    TokenResponse,
    UserLoginRequest,
    UserRegisterRequest,
    UserResponse,
)
from app.services.auth.account_deletion_service import delete_own_account
from app.services.auth.auth_service import (
    authenticate_user,
    google_account_exists,
    login_or_register_with_google,
    register_user,
)
from app.services.auth.errors import BetaLimitReachedError, EmailAlreadyRegisteredError, InvalidCredentialsError
from app.services.currency.errors import UnsupportedCurrencyError
from app.shared.google_auth import GoogleAuthError
from app.shared.turnstile import TurnstileVerificationError, verify_turnstile

router = APIRouter()


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("10/minute")
async def register(request: Request, payload: UserRegisterRequest, db: Session = Depends(get_db)) -> TokenResponse:
    try:
        verify_turnstile(payload.turnstile_token, get_client_ip(request))
        user = register_user(
            db,
            payload.email,
            payload.password,
            payload.display_name,
            default_currency=payload.default_currency,
            wallets=payload.wallets,
        )
    except TurnstileVerificationError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except BetaLimitReachedError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except EmailAlreadyRegisteredError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    except UnsupportedCurrencyError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    token = create_access_token(subject=str(user.id))
    return TokenResponse(access_token=token, user=UserResponse.model_validate(user))


@router.post("/login", response_model=TokenResponse)
@limiter.limit("10/minute")
async def login(request: Request, payload: UserLoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    try:
        verify_turnstile(payload.turnstile_token, get_client_ip(request))
        user = authenticate_user(db, payload.email, payload.password)
    except TurnstileVerificationError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except InvalidCredentialsError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc

    token = create_access_token(subject=str(user.id))
    return TokenResponse(access_token=token, user=UserResponse.model_validate(user))


@router.post("/google", response_model=TokenResponse)
@limiter.limit("10/minute")
async def google_login(request: Request, payload: GoogleLoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    try:
        user = login_or_register_with_google(
            db, payload.id_token, default_currency=payload.default_currency, wallets=payload.wallets
        )
    except GoogleAuthError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except BetaLimitReachedError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except UnsupportedCurrencyError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    token = create_access_token(subject=str(user.id))
    return TokenResponse(access_token=token, user=UserResponse.model_validate(user))


@router.post("/google/check", response_model=GoogleCheckResponse)
@limiter.limit("20/minute")
async def google_check(
    request: Request, payload: GoogleCheckRequest, db: Session = Depends(get_db)
) -> GoogleCheckResponse:
    try:
        exists = google_account_exists(db, payload.id_token)
    except GoogleAuthError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    return GoogleCheckResponse(exists=exists)


@router.get("/me", response_model=UserResponse)
async def me(current_user: User = Depends(get_current_user)) -> UserResponse:
    return UserResponse.model_validate(current_user)


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit("5/minute")
async def delete_me(
    request: Request, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> None:
    delete_own_account(db, current_user)
