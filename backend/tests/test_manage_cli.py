import manage
from app.services.debts.debt_service import list_debts_for_user
from app.services.devTools.demo_seed_service import DEMO_EMAIL, get_or_create_demo_user
from app.services.transactions.transaction_service import list_transactions_for_user
from app.services.wallets.wallet_service import list_wallets_for_user


def test_delete_demo_user_data_removes_everything_without_fk_errors(db):
    user = get_or_create_demo_user(db)
    assert list_wallets_for_user(db, user.id)  # confirma que sí había algo que borrar

    manage._delete_demo_user_data(db, user)

    # Recrear debe funcionar limpio (probando que no quedó nada huérfano bloqueando).
    recreated = get_or_create_demo_user(db)
    assert recreated.email == DEMO_EMAIL
    assert recreated.id != user.id
    assert len(list_wallets_for_user(db, recreated.id)) == 3
    assert len(list_transactions_for_user(db, recreated.id)) == 15
    assert len(list_debts_for_user(db, recreated.id)) == 2
