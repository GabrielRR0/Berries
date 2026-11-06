from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.common.security import get_current_user
from app.database import get_db
from app.common.security import get_client_ip, limiter
from app.common.security import create_access_token
from app.modules.auth.models.user_model import User
from app.modules.auth.contracts.dto import GoogleCheckDto, GoogleLoginDto, LoginDto, RegisterUserDto
from app.modules.auth.contracts.resources import GoogleCheckResource, TokenResource, UserResource
from app.modules.auth.services.account_deletion_service import delete_own_account
from app.modules.auth.services.auth_service import (
    authenticate_user,
    google_account_exists,
    login_or_register_with_google,
    register_user,
)
from app.modules.auth.errors import BetaLimitReachedError, EmailAlreadyRegisteredError, InvalidCredentialsError
from app.modules.currency import UnsupportedCurrencyError
from app.support.google_identity_support import GoogleAuthError
from app.support.turnstile_support import TurnstileVerificationError, verify_turnstile

router = APIRouter()


@router.post("/register", response_model=TokenResource, status_code=status.HTTP_201_CREATED)
@limiter.limit("10/minute")
async def register(request: Request, payload: RegisterUserDto, db: Session = Depends(get_db)) -> TokenResource:
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
    return TokenResource(access_token=token, user=UserResource.model_validate(user))


@router.post("/login", response_model=TokenResource)
@limiter.limit("10/minute")
async def login(request: Request, payload: LoginDto, db: Session = Depends(get_db)) -> TokenResource:
    try:
        verify_turnstile(payload.turnstile_token, get_client_ip(request))
        user = authenticate_user(db, payload.email, payload.password)
    except TurnstileVerificationError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except InvalidCredentialsError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc

    token = create_access_token(subject=str(user.id))
    return TokenResource(access_token=token, user=UserResource.model_validate(user))


@router.post("/google", response_model=TokenResource)
@limiter.limit("10/minute")
async def google_login(request: Request, payload: GoogleLoginDto, db: Session = Depends(get_db)) -> TokenResource:
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
    return TokenResource(access_token=token, user=UserResource.model_validate(user))


@router.post("/google/check", response_model=GoogleCheckResource)
@limiter.limit("20/minute")
async def google_check(
    request: Request, payload: GoogleCheckDto, db: Session = Depends(get_db)
) -> GoogleCheckResource:
    try:
        exists = google_account_exists(db, payload.id_token)
    except GoogleAuthError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    return GoogleCheckResource(exists=exists)


@router.get("/me", response_model=UserResource)
async def me(current_user: User = Depends(get_current_user)) -> UserResource:
    return UserResource.model_validate(current_user)


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit("5/minute")
async def delete_me(
    request: Request, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> None:
    delete_own_account(db, current_user)
