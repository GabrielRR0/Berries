from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.models.auth.user_model import User
from app.models.debts.debt_model import Debt
from app.models.debts.debt_payment_model import DebtPayment
from app.models.debts.installment_model import Installment
from app.models.goals.goal_check_in_model import GoalCheckIn
from app.models.goals.goal_model import Goal
from app.models.transactions.category_model import Category
from app.models.transactions.hidden_category_model import HiddenCategory
from app.models.transactions.transaction_draft_model import TransactionDraft
from app.models.transactions.transaction_model import Transaction
from app.models.wallets.wallet_model import Wallet


def delete_own_account(db: Session, user: User) -> None:
    """Borra la cuenta del usuario autenticado y absolutamente todo lo que le pertenece
    (self-service, "no dejar rastro" - pedido explicito del usuario). Ninguna FK de este
    proyecto tiene ondelete=CASCADE a nivel de base de datos (ver migraciones) - un
    borrado directo de User violaria una FK en Postgres/produccion, y en SQLite (donde
    foreign_keys no esta prendido) dejaria filas huerfanas silenciosamente. Por eso cada
    tabla hija se borra a mano, en orden (hijos antes que padres), todo en una sola
    transaccion. Nunca toca filas compartidas: categorias por defecto
    (Category.user_id is None), el catalogo de Currency, ni el cache de ExchangeRate."""
    debt_ids = db.scalars(select(Debt.id).where(Debt.user_id == user.id)).all()
    if debt_ids:
        db.execute(delete(Installment).where(Installment.debt_id.in_(debt_ids)))
        # DebtPayment referencia debt_id (por Debt, borrada mas abajo) Y transaction_id
        # (por Transaction, borrada mas abajo en este mismo metodo) - tiene que irse
        # antes que ambas, no solo antes que Debt (bug real: encontrado probando en
        # vivo contra Postgres, invisible en SQLite/tests porque ahi las FK no se
        # validan - ver bitacora de debt_payment_service.delete_debt_payment).
        db.execute(delete(DebtPayment).where(DebtPayment.debt_id.in_(debt_ids)))
    db.execute(delete(Debt).where(Debt.user_id == user.id))

    goal_ids = db.scalars(select(Goal.id).where(Goal.user_id == user.id)).all()
    if goal_ids:
        db.execute(delete(GoalCheckIn).where(GoalCheckIn.goal_id.in_(goal_ids)))
    db.execute(delete(Goal).where(Goal.user_id == user.id))

    # Transaction/TransactionDraft antes que Wallet - referencian wallet_id.
    db.execute(delete(Transaction).where(Transaction.user_id == user.id))
    db.execute(delete(TransactionDraft).where(TransactionDraft.user_id == user.id))

    # HiddenCategory antes que Category - referencia category_id (incluidas las
    # categorias custom del propio usuario que se borran despues).
    db.execute(delete(HiddenCategory).where(HiddenCategory.user_id == user.id))
    db.execute(delete(Category).where(Category.user_id == user.id))

    db.execute(delete(Wallet).where(Wallet.user_id == user.id))

    db.delete(user)
    db.commit()
