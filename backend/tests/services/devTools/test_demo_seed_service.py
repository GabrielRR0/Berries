from app.services.debts.debt_service import list_debts_for_user
from app.services.devTools.demo_seed_service import DEMO_EMAIL, get_or_create_demo_user
from app.services.transactions.transaction_service import list_transactions_for_user
from app.services.wallets.wallet_service import list_wallets_for_user


def test_get_or_create_demo_user_seeds_wallets_transactions_and_debts(db):
    user = get_or_create_demo_user(db)

    assert user.email == DEMO_EMAIL
    assert len(list_wallets_for_user(db, user.id)) == 3
    assert len(list_transactions_for_user(db, user.id)) == 15
    debts = list_debts_for_user(db, user.id)
    assert len(debts) == 2
    assert any(debt.installments for debt in debts)


def test_get_or_create_demo_user_is_idempotent(db):
    first = get_or_create_demo_user(db)
    second = get_or_create_demo_user(db)

    assert first.id == second.id
    # No debe duplicar wallets en una segunda llamada.
    assert len(list_wallets_for_user(db, first.id)) == 3
