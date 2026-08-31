from decimal import Decimal

import pytest

from app.config import settings
from app.schemas.auth.auth_schemas import WalletSeedRequest
from app.services.auth import auth_service
from app.services.auth.auth_service import (
    authenticate_user,
    google_account_exists,
    login_or_register_with_google,
    register_user,
)
from app.services.auth.errors import BetaLimitReachedError, EmailAlreadyRegisteredError, InvalidCredentialsError
from app.services.currency.errors import UnsupportedCurrencyError
from app.services.wallets.wallet_service import list_wallets_for_user
from app.shared.google_auth import GoogleIdentity

# El fixture `db` vive en tests/conftest.py (pytest lo inyecta automáticamente a
# cualquier test bajo tests/) — no se importa como módulo para evitar una segunda
# carga de conftest.py con su propio engine desincronizado.


def test_register_user_hashes_password(db):
    user = register_user(db, "eva@example.com", "clave12345", "Eva")

    assert user.email == "eva@example.com"
    assert user.password_hash != "clave12345"


def test_register_user_rejects_duplicate_email(db):
    register_user(db, "fede@example.com", "clave12345", None)

    with pytest.raises(EmailAlreadyRegisteredError):
        register_user(db, "fede@example.com", "otraclave", None)


def test_register_user_rejects_past_beta_limit(db, monkeypatch):
    monkeypatch.setattr(settings, "max_beta_users", 1)
    register_user(db, "gus@example.com", "clave12345", None)

    with pytest.raises(BetaLimitReachedError):
        register_user(db, "hugo@example.com", "clave12345", None)


def test_register_user_defaults_to_usd_when_no_currency_given(db):
    user = register_user(db, "karla@example.com", "clave12345", None)

    assert user.default_currency == "USD"


def test_register_user_accepts_a_chosen_default_currency(db):
    user = register_user(db, "leo@example.com", "clave12345", None, default_currency="VEF")

    assert user.default_currency == "VEF"


def test_register_user_rejects_an_unsupported_default_currency(db):
    with pytest.raises(UnsupportedCurrencyError):
        register_user(db, "mia@example.com", "clave12345", None, default_currency="XYZ")


def test_register_user_creates_wallets_from_the_wizard(db):
    wallets = [
        WalletSeedRequest(name="Facebank", currency="USD", initial_balance=Decimal("150.50")),
        WalletSeedRequest(name="Banco de Venezuela", currency="VEF", initial_balance=Decimal("0")),
    ]

    user = register_user(db, "nora@example.com", "clave12345", None, wallets=wallets)

    created = list_wallets_for_user(db, user.id)
    assert len(created) == 2
    assert {(w.name, w.currency, w.balance) for w in created} == {
        ("Facebank", "USD", Decimal("150.50")),
        ("Banco de Venezuela", "VEF", Decimal("0")),
    }


def test_register_user_with_no_wallets_starts_empty(db):
    user = register_user(db, "omar@example.com", "clave12345", None)

    assert list_wallets_for_user(db, user.id) == []


def test_register_user_rejects_a_wallet_with_an_unsupported_currency(db):
    wallets = [WalletSeedRequest(name="Rara", currency="XYZ")]

    with pytest.raises(UnsupportedCurrencyError):
        register_user(db, "paula@example.com", "clave12345", None, wallets=wallets)


def test_login_or_register_with_google_creates_a_new_user(db, monkeypatch):
    monkeypatch.setattr(
        auth_service,
        "verify_google_id_token",
        lambda token: GoogleIdentity(sub="google-1", email="quim@example.com", email_verified=True, name="Quim"),
    )

    user = login_or_register_with_google(db, "token")

    assert user.email == "quim@example.com"
    assert user.display_name == "Quim"
    assert user.default_currency == "USD"


def test_login_or_register_with_google_reuses_the_same_account_on_a_second_login(db, monkeypatch):
    monkeypatch.setattr(
        auth_service,
        "verify_google_id_token",
        lambda token: GoogleIdentity(sub="google-2", email="rita@example.com", email_verified=True, name="Rita"),
    )

    first = login_or_register_with_google(db, "token")
    second = login_or_register_with_google(db, "token")

    assert first.id == second.id


def test_login_or_register_with_google_links_an_existing_email_password_account(db, monkeypatch):
    existing = register_user(db, "sole@example.com", "clave12345", "Sole")
    monkeypatch.setattr(
        auth_service,
        "verify_google_id_token",
        lambda token: GoogleIdentity(sub="google-3", email="sole@example.com", email_verified=True, name="Sole G"),
    )

    linked = login_or_register_with_google(db, "token")

    assert linked.id == existing.id
    assert linked.google_sub == "google-3"


def test_google_account_exists_is_false_for_an_unknown_identity(db, monkeypatch):
    monkeypatch.setattr(
        auth_service,
        "verify_google_id_token",
        lambda token: GoogleIdentity(sub="google-9", email="nueva@example.com", email_verified=True, name="Nueva"),
    )

    assert google_account_exists(db, "token") is False


def test_google_account_exists_is_true_once_the_account_was_created(db, monkeypatch):
    monkeypatch.setattr(
        auth_service,
        "verify_google_id_token",
        lambda token: GoogleIdentity(sub="google-10", email="tere@example.com", email_verified=True, name="Tere"),
    )
    login_or_register_with_google(db, "token")

    assert google_account_exists(db, "token") is True


def test_google_account_exists_is_true_for_an_email_registered_with_a_password(db, monkeypatch):
    register_user(db, "nico@example.com", "clave12345", "Nico")
    monkeypatch.setattr(
        auth_service,
        "verify_google_id_token",
        lambda token: GoogleIdentity(sub="google-11", email="nico@example.com", email_verified=True, name="Nico G"),
    )

    assert google_account_exists(db, "token") is True


def test_google_account_exists_never_links_the_account_as_a_side_effect(db, monkeypatch):
    existing = register_user(db, "vale@example.com", "clave12345", "Vale")
    monkeypatch.setattr(
        auth_service,
        "verify_google_id_token",
        lambda token: GoogleIdentity(sub="google-12", email="vale@example.com", email_verified=True, name="Vale G"),
    )

    google_account_exists(db, "token")

    db.refresh(existing)
    assert existing.google_sub is None


def test_login_or_register_with_google_rejects_past_beta_limit_for_new_users(db, monkeypatch):
    monkeypatch.setattr(settings, "max_beta_users", 0)
    monkeypatch.setattr(
        auth_service,
        "verify_google_id_token",
        lambda token: GoogleIdentity(sub="google-4", email="tono@example.com", email_verified=True, name="Tono"),
    )

    with pytest.raises(BetaLimitReachedError):
        login_or_register_with_google(db, "token")


def test_authenticate_user_succeeds_with_correct_password(db):
    register_user(db, "ines@example.com", "clave12345", None)

    user = authenticate_user(db, "ines@example.com", "clave12345")

    assert user.email == "ines@example.com"


def test_authenticate_user_rejects_wrong_password(db):
    register_user(db, "juan@example.com", "clave12345", None)

    with pytest.raises(InvalidCredentialsError):
        authenticate_user(db, "juan@example.com", "incorrecta")


def test_authenticate_user_rejects_unknown_email(db):
    with pytest.raises(InvalidCredentialsError):
        authenticate_user(db, "nadie@example.com", "clave12345")


def test_authenticate_user_uses_demo_account_when_fake_mode_active(db, monkeypatch):
    monkeypatch.setattr(settings, "fake_data_mode", True)

    user = authenticate_user(db, "cualquiera@random.com", "cualquier-cosa")

    assert user.email == "demo@berry.local"
    # El usuario demo se crea con datos sembrados (wallets/transacciones/deudas) la
    # primera vez que se resuelve — probar que no arranca vacío.
    from app.services.wallets.wallet_service import list_wallets_for_user

    assert len(list_wallets_for_user(db, user.id)) > 0


def test_authenticate_user_reuses_same_demo_account_across_logins(db, monkeypatch):
    monkeypatch.setattr(settings, "fake_data_mode", True)

    first = authenticate_user(db, "a@x.com", "x")
    second = authenticate_user(db, "b@y.com", "y")

    assert first.id == second.id


def test_fake_data_mode_never_activates_in_production(db, monkeypatch):
    monkeypatch.setattr(settings, "fake_data_mode", True)
    monkeypatch.setattr(settings, "environment", "production")

    with pytest.raises(InvalidCredentialsError):
        authenticate_user(db, "cualquiera@random.com", "cualquier-cosa")
