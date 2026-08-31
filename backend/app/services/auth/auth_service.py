import uuid

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import settings
from app.core.security import hash_password, verify_password
from app.models.auth.user_model import User
from app.schemas.auth.auth_schemas import WalletSeedRequest
from app.services.auth.errors import BetaLimitReachedError, EmailAlreadyRegisteredError, InvalidCredentialsError
from app.services.currency.currency_lookup import get_currency_by_code
from app.services.devTools.demo_seed_service import get_or_create_demo_user
from app.services.wallets.wallet_service import create_wallet
from app.shared.google_auth import GoogleIdentity, verify_google_id_token


def register_user(
    db: Session,
    email: str,
    password: str,
    display_name: str | None,
    default_currency: str = "USD",
    wallets: list[WalletSeedRequest] | None = None,
) -> User:
    active_users = db.scalar(select(func.count()).select_from(User))
    if active_users is not None and active_users >= settings.max_beta_users:
        raise BetaLimitReachedError(f"Límite de beta ({settings.max_beta_users} usuarios) alcanzado")

    existing = db.scalar(select(User).where(User.email == email))
    if existing is not None:
        raise EmailAlreadyRegisteredError("Ese email ya está registrado")

    default_currency_id = get_currency_by_code(db, default_currency).id
    user = User(
        email=email,
        password_hash=hash_password(password),
        display_name=display_name,
        default_currency_id=default_currency_id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # Billeteras elegidas en el wizard de registro (ver RegisterWizard.vue paso 2) -
    # mismo patron que demo_seed_service.py: el user ya esta comiteado, cada wallet se
    # crea/comitea aparte via create_wallet(), sin una transaccion atomica nueva.
    for seed in wallets or []:
        create_wallet(db, user.id, seed.name, seed.currency, seed.initial_balance)

    return user


def _create_user_from_google(
    db: Session,
    identity: GoogleIdentity,
    default_currency: str,
    wallets: list[WalletSeedRequest] | None = None,
) -> User:
    active_users = db.scalar(select(func.count()).select_from(User))
    if active_users is not None and active_users >= settings.max_beta_users:
        raise BetaLimitReachedError(f"Límite de beta ({settings.max_beta_users} usuarios) alcanzado")

    default_currency_id = get_currency_by_code(db, default_currency).id
    user = User(
        email=identity.email,
        # Nadie conoce este password - una cuenta de Google nunca se pensó para
        # loguearse con contraseña, ver comentario en el modelo.
        password_hash=hash_password(uuid.uuid4().hex),
        display_name=identity.name,
        google_sub=identity.sub,
        default_currency_id=default_currency_id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # Mismo patron que register_user(): el wizard de registro sigue pidiendo
    # billeteras/moneda despues de "Continuar con Google" (solo se saltea el
    # paso de correo/clave, no el resto), asi que una cuenta nueva de Google
    # tambien puede llegar con billeteras para sembrar.
    for seed in wallets or []:
        create_wallet(db, user.id, seed.name, seed.currency, seed.initial_balance)

    return user


def login_or_register_with_google(
    db: Session,
    id_token: str | None,
    default_currency: str = "USD",
    wallets: list[WalletSeedRequest] | None = None,
) -> User:
    """Verifica el ID token de Google y resuelve a un User, en este orden: 1) ya existe
    una cuenta vinculada a este google_sub -> esa; 2) existe una cuenta con el mismo
    email (se registró antes con correo/clave) -> se vincula (google_sub se completa) y
    se usa esa misma cuenta, no se duplica; 3) no existe ninguna -> se crea una nueva
    (con el mismo límite de beta que register_user). `wallets`/`default_currency` solo
    aplican en la rama de cuenta nueva - una cuenta que ya existía tiene sus propias
    billeteras y moneda, no se le pisan."""
    identity = verify_google_id_token(id_token)

    by_sub = db.scalar(select(User).where(User.google_sub == identity.sub))
    if by_sub is not None:
        return by_sub

    by_email = db.scalar(select(User).where(User.email == identity.email))
    if by_email is not None:
        by_email.google_sub = identity.sub
        db.commit()
        db.refresh(by_email)
        return by_email

    return _create_user_from_google(db, identity, default_currency, wallets)


def google_account_exists(db: Session, id_token: str | None) -> bool:
    """Verifica el ID token y responde si ya existe una cuenta para esa identidad de
    Google, SIN crear ni modificar nada (a diferencia de login_or_register_with_google,
    que ademas vincula por email) - usado por LoginForm.vue para decidir si "Continuar
    con Google" loguea directo o manda al wizard completo de registro (una cuenta nueva
    de Google necesita billeteras/moneda, no solo un login silencioso con USD y cero
    billeteras)."""
    identity = verify_google_id_token(id_token)

    by_sub = db.scalar(select(User).where(User.google_sub == identity.sub))
    if by_sub is not None:
        return True

    by_email = db.scalar(select(User).where(User.email == identity.email))
    return by_email is not None


def authenticate_user(db: Session, email: str, password: str) -> User:
    # Modo demo: cualquier email/password entra al usuario demo con datos sembrados,
    # para poder revisar la UI sin registrar una cuenta real. `fake_data_mode_active`
    # (no `fake_data_mode` a secas) ya descarta esto si environment=="production".
    if settings.fake_data_mode_active:
        return get_or_create_demo_user(db)

    user = db.scalar(select(User).where(User.email == email))
    if user is None or not verify_password(password, user.password_hash):
        raise InvalidCredentialsError("Email o contraseña incorrectos")
    return user
