from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy import select

from app.models.auth.user_model import User
from app.models.currency.currency_model import Currency
from app.models.debts.debt_model import Debt
from app.models.debts.installment_model import Installment
from app.models.goals.goal_check_in_model import GoalCheckIn
from app.models.goals.goal_model import Goal
from app.models.transactions.category_model import Category
from app.models.transactions.hidden_category_model import HiddenCategory
from app.models.transactions.transaction_draft_model import TransactionDraft
from app.models.transactions.transaction_model import Transaction
from app.models.wallets.wallet_model import Wallet
from app.services.auth.account_deletion_service import delete_own_account
from app.services.auth.auth_service import register_user
from app.services.debts.debt_service import create_debt
from app.services.goals.check_in_service import record_check_in
from app.services.goals.goal_service import create_goal
from app.services.transactions.categories.category_service import create_category
from app.services.transactions.transaction_service import create_transaction
from app.services.wallets.wallet_service import create_wallet


def _seed_full_account(db, email: str) -> User:
    """Crea un usuario con una fila en cada tabla que le pertenece, para poder
    verificar que delete_own_account no deja rastro en ninguna."""
    user = register_user(db, email, "supersecret123", "Ana")

    wallet = create_wallet(db, user.id, "Efectivo", "USD", Decimal("500"))
    create_transaction(db, user.id, wallet.id, "expense", Decimal("20"), "Comida")

    debt = create_debt(
        db,
        user.id,
        "Cashea",
        "owed_by_user",
        Decimal("100"),
        "USD",
        installment_count=3,
        first_due_date=date.today(),
    )
    assert db.scalar(select(Installment).where(Installment.debt_id == debt.id)) is not None

    goal = create_goal(db, user.id, "MacBook", Decimal("1200"), "USD", date.today() + timedelta(days=90))
    record_check_in(db, goal.id, user.id, Decimal("100"))

    draft = TransactionDraft(user_id=user.id, source="voice", raw_input="gasté 20 en comida")
    db.add(draft)

    custom_category = create_category(db, user.id, "Suscripciones", "expense")

    default_category = db.scalar(select(Category).where(Category.user_id.is_(None)))
    db.add(HiddenCategory(user_id=user.id, category_id=default_category.id))
    db.commit()

    return user


def test_delete_own_account_removes_every_row_the_user_owns(db):
    user = _seed_full_account(db, "ana@example.com")
    user_id = user.id

    delete_own_account(db, user)

    assert db.get(User, user_id) is None
    assert db.scalars(select(Wallet).where(Wallet.user_id == user_id)).all() == []
    assert db.scalars(select(Transaction).where(Transaction.user_id == user_id)).all() == []
    assert db.scalars(select(Debt).where(Debt.user_id == user_id)).all() == []
    assert db.scalars(select(Installment)).all() == []
    assert db.scalars(select(Goal).where(Goal.user_id == user_id)).all() == []
    assert db.scalars(select(GoalCheckIn)).all() == []
    assert db.scalars(select(TransactionDraft).where(TransactionDraft.user_id == user_id)).all() == []
    assert db.scalars(select(HiddenCategory).where(HiddenCategory.user_id == user_id)).all() == []
    assert db.scalars(select(Category).where(Category.user_id == user_id)).all() == []


def test_delete_own_account_never_touches_shared_defaults(db):
    user = _seed_full_account(db, "ana@example.com")

    delete_own_account(db, user)

    # Categorías compartidas por defecto (DEFAULT_CATEGORIES, sembradas por
    # _reset_database en conftest.py) y el catálogo de monedas sobreviven.
    assert db.scalars(select(Category).where(Category.user_id.is_(None))).all() != []
    assert db.scalars(select(Currency)).all() != []


def test_delete_own_account_does_not_touch_another_users_data(db):
    victim = _seed_full_account(db, "ana@example.com")
    survivor = _seed_full_account(db, "beto@example.com")

    delete_own_account(db, victim)

    assert db.get(User, survivor.id) is not None
    assert len(db.scalars(select(Wallet).where(Wallet.user_id == survivor.id)).all()) == 1
    assert len(db.scalars(select(Transaction).where(Transaction.user_id == survivor.id)).all()) == 1
    assert len(db.scalars(select(Debt).where(Debt.user_id == survivor.id)).all()) == 1
    assert len(db.scalars(select(Goal).where(Goal.user_id == survivor.id)).all()) == 1
