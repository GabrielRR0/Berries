from fastapi import Request, status

from app.common.security import AUTH_ENDPOINT_LIMIT, get_client_ip, limiter, public_group
from app.database import DbSession
from app.modules.auth import services
from app.modules.auth.contracts.dto import GoogleCheckDto, GoogleLoginDto, LoginDto, RegisterUserDto
from app.modules.auth.contracts.resources import GoogleCheckResource, TokenResource

router = public_group()

# `request` lo exige el limitador de pedidos (slowapi) en las rutas con límite propio.


@router.post("/register", response_model=TokenResource, status_code=status.HTTP_201_CREATED)
@limiter.limit(AUTH_ENDPOINT_LIMIT)
async def register(request: Request, payload: RegisterUserDto, db: DbSession) -> TokenResource:
    services.verify_human(payload.turnstile_token, get_client_ip(request))
    user = services.register_user(
        db,
        payload.email,
        payload.password,
        payload.display_name,
        default_currency=payload.default_currency,
        wallets=payload.wallets,
    )
    return services.issue_session(user)


@router.post("/login", response_model=TokenResource)
@limiter.limit(AUTH_ENDPOINT_LIMIT)
async def login(request: Request, payload: LoginDto, db: DbSession) -> TokenResource:
    services.verify_human(payload.turnstile_token, get_client_ip(request))
    return services.issue_session(services.authenticate_user(db, payload.email, payload.password))


@router.post("/google", response_model=TokenResource)
@limiter.limit(AUTH_ENDPOINT_LIMIT)
async def google_login(request: Request, payload: GoogleLoginDto, db: DbSession) -> TokenResource:
    user = services.login_or_register_with_google(
        db, payload.id_token, default_currency=payload.default_currency, wallets=payload.wallets
    )
    return services.issue_session(user)


@router.post("/google/check", response_model=GoogleCheckResource)
@limiter.limit("20/minute")
async def google_check(request: Request, payload: GoogleCheckDto, db: DbSession) -> GoogleCheckResource:
    return GoogleCheckResource(exists=services.google_account_exists(db, payload.id_token))
