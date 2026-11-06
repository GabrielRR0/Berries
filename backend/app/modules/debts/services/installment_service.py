"""Marcar cuotas como pagadas o pendientes."""

import uuid
from datetime import date, datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.debts.models.debt_model import Debt
from app.modules.debts.models.installment_model import Installment
from app.modules.debts.errors import DebtNotFoundError, InstallmentAlreadyPaidError
from app.modules.debts.services.debt_service import get_debt_owned_by_user


def _get_owned_installment(db: Session, installment_id: uuid.UUID, user_id: uuid.UUID) -> Installment:
    installment = db.get(Installment, installment_id)
    if installment is None or installment.debt.user_id != user_id:
        raise DebtNotFoundError("Cuota no encontrada")
    return installment


def mark_installment_paid(db: Session, installment_id: uuid.UUID, user_id: uuid.UUID) -> Installment:
    installment = _get_owned_installment(db, installment_id, user_id)
    if installment.status == "paid":
        raise InstallmentAlreadyPaidError("La cuota ya está pagada")

    installment.status = "paid"
    installment.paid_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(installment)
    return installment


def mark_installment_unpaid(db: Session, installment_id: uuid.UUID, user_id: uuid.UUID) -> Installment:
    installment = _get_owned_installment(db, installment_id, user_id)
    installment.status = "pending"
    installment.paid_at = None
    db.commit()
    db.refresh(installment)
    return installment


def list_installments_for_debt(db: Session, debt_id: uuid.UUID, user_id: uuid.UUID) -> list[Installment]:
    debt = db.get(Debt, debt_id)
    if debt is None or debt.user_id != user_id:
        raise DebtNotFoundError("Deuda no encontrada")
    stmt = select(Installment).where(Installment.debt_id == debt_id).order_by(Installment.due_date)
    return list(db.scalars(stmt).all())


def get_due_installments(db: Session, on_date: date) -> list[Installment]:
    """Scan GLOBAL a propósito (sin filtro de usuario): esta función la reutilizará
    un futuro cron de recordatorios que itera todos los usuarios. Incluye vencidas y
    las que vencen hoy; el caller resuelve el dueño vía `installment.debt.user_id`
    gracias a la relationship, sin necesitar una segunda query manual."""
    stmt = select(Installment).where(Installment.status == "pending", Installment.due_date <= on_date)
    return list(db.scalars(stmt).all())


def pay_installment_of_debt(db: Session, debt_id: uuid.UUID, installment_id: uuid.UUID, user_id: uuid.UUID) -> Installment:
    """Lo que usa la ruta: primero confirma que la deuda es del usuario (404 si no) y
    después marca la cuota como pagada."""
    get_debt_owned_by_user(db, debt_id, user_id)
    return mark_installment_paid(db, installment_id, user_id)


def unpay_installment_of_debt(db: Session, debt_id: uuid.UUID, installment_id: uuid.UUID, user_id: uuid.UUID) -> Installment:
    get_debt_owned_by_user(db, debt_id, user_id)
    return mark_installment_unpaid(db, installment_id, user_id)
