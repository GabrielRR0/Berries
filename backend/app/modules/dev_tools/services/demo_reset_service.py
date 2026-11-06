"""Borrar el usuario demo y todo lo que se le sembró (lo usa `manage.py seed:demo --reset`)."""

from sqlalchemy.orm import Session

from app.modules.auth import User
from app.modules.debts import Debt
from app.modules.dev_tools.services.demo_seed_service import DEMO_EMAIL
from app.modules.transactions import Transaction, TransactionDraft
from app.modules.wallets import Wallet


def delete_demo_user_data(db: Session, user: User) -> None:
    """Borra en el orden correcto para no pisar foreign keys: `cascade="all,
    delete-orphan"` de Debt.installments solo aplica a borrados objeto-por-objeto vía
    la sesión ORM (`db.delete(obj)`), no a un DELETE masivo — por eso acá se borra cada
    fila explícitamente en vez de un solo `delete(User)...`."""
    for model in (Transaction, TransactionDraft):
        for row in db.query(model).filter(model.user_id == user.id):
            db.delete(row)

    for debt in db.query(Debt).filter(Debt.user_id == user.id):
        db.delete(debt)  # cascade="all, delete-orphan" sí aplica acá: borra sus installments

    for wallet in db.query(Wallet).filter(Wallet.user_id == user.id):
        db.delete(wallet)

    db.delete(user)
    db.commit()


def reset_demo_user(db: Session) -> bool:
    """Borra el usuario demo si existe. Devuelve si había uno."""
    existing = db.query(User).filter(User.email == DEMO_EMAIL).one_or_none()
    if existing is None:
        return False
    delete_demo_user_data(db, existing)
    return True
