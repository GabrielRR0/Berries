from decimal import Decimal

import pytest

from app.services.auth.auth_service import register_user
from app.services.wallets.errors import WalletNotFoundError
from app.services.wallets.wallet_service import create_wallet, delete_wallet, get_wallet_owned_by_user, list_wallets_for_user

# El fixture `db` vive en tests/conftest.py y se inyecta automáticamente.


def _user(db, email="ana@example.com"):
    return register_user(db, email, "clave12345", "Ana")


def test_create_wallet_starts_with_zero_balance(db):
    user = _user(db)

    wallet = create_wallet(db, user.id, "Cash", "USD")

    assert wallet.name == "Cash"
    assert wallet.currency == "USD"
    assert wallet.balance == 0


def test_create_wallet_accepts_an_initial_balance(db):
    user = _user(db)

    wallet = create_wallet(db, user.id, "Facebank", "USD", Decimal("150.50"))

    assert wallet.balance == Decimal("150.50")


def test_list_wallets_for_user_returns_only_own_wallets(db):
    user_a = _user(db, "a@example.com")
    user_b = _user(db, "b@example.com")
    create_wallet(db, user_a.id, "Cash", "USD")
    create_wallet(db, user_a.id, "Banco", "VEF")
    create_wallet(db, user_b.id, "Zinli", "USD")

    wallets = list_wallets_for_user(db, user_a.id)

    assert len(wallets) == 2
    assert {w.name for w in wallets} == {"Cash", "Banco"}


def test_get_wallet_owned_by_user_rejects_other_users_wallet(db):
    user_a = _user(db, "a@example.com")
    user_b = _user(db, "b@example.com")
    wallet = create_wallet(db, user_a.id, "Cash", "USD")

    with pytest.raises(WalletNotFoundError):
        get_wallet_owned_by_user(db, wallet.id, user_b.id)


def test_delete_wallet_removes_it(db):
    user = _user(db)
    wallet = create_wallet(db, user.id, "Cash", "USD")

    delete_wallet(db, wallet.id, user.id)

    with pytest.raises(WalletNotFoundError):
        get_wallet_owned_by_user(db, wallet.id, user.id)


def test_delete_wallet_rejects_other_users_wallet(db):
    user_a = _user(db, "a@example.com")
    user_b = _user(db, "b@example.com")
    wallet = create_wallet(db, user_a.id, "Cash", "USD")

    with pytest.raises(WalletNotFoundError):
        delete_wallet(db, wallet.id, user_b.id)
