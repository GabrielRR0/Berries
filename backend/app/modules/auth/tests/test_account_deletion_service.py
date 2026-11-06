from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy import select

from app.modules.auth.models.user_model import User
from app.modules.currency import Currency
from app.modules.debts import Debt
from app.modules.debts import DebtPayment
from app.modules.debts import Installment
from app.modules.goals import GoalCheckIn
from app.modules.goals import Goal
from app.modules.categories import Category
from app.modules.categories import HiddenCategory
from app.modules.transactions import TransactionDraft
from app.modules.transactions import Transaction
from app.modules.wallets import Wallet
from app.modules.auth.services.account_deletion_service import delete_own_account
from app.modules.auth.services.auth_service import register_user
from app.modules.debts import create_debt_payment
from app.modules.debts import create_debt
from app.modules.goals import record_check_in
from app.modules.goals import create_goal
from app.modules.categories import create_category
from app.modules.transactions import create_transaction
from app.modules.wallets import create_wallet


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

    # Con wallet_id: ademas de la fila de DebtPayment, deja una Transaction propia -
    # borrar la cuenta tiene que limpiar ambas sin violar ninguna FK (bug real
    # encontrado probando en vivo contra Postgres, ver account_deletion_service.py).
    create_debt_payment(db, debt.id, user.id, amount=Decimal("10"), currency="USD", wallet_id=wallet.id)

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
    assert db.scalars(select(DebtPayment)).all() == []
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
    # 2, no 1: la manual de _seed_full_account + la que genera create_debt_payment
    # con wallet_id (ver comentario arriba, en _seed_full_account).
    assert len(db.scalars(select(Transaction).where(Transaction.user_id == survivor.id)).all()) == 2
    assert len(db.scalars(select(Debt).where(Debt.user_id == survivor.id)).all()) == 1
    assert len(db.scalars(select(Goal).where(Goal.user_id == survivor.id)).all()) == 1
    survivor_debt_id = db.scalar(select(Debt.id).where(Debt.user_id == survivor.id))
    assert len(db.scalars(select(DebtPayment).where(DebtPayment.debt_id == survivor_debt_id)).all()) == 1
