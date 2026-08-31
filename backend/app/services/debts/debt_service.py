import uuid
from datetime import date, timedelta
from decimal import ROUND_HALF_UP, Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.debts.debt_model import Debt
from app.models.debts.installment_model import Installment
from app.services.currency.currency_lookup import get_currency_by_code
from app.services.debts.errors import DebtNotFoundError, DebtValidationError


def create_debt(
    db: Session,
    user_id: uuid.UUID,
    counterparty_name: str,
    direction: str,
    total_amount: Decimal,
    currency: str,
    description: str | None = None,
    installment_count: int | None = None,
    first_due_date: date | None = None,
    frequency_days: int = 30,
) -> Debt:
    total_amount = Decimal(total_amount)
    if total_amount <= 0:
        raise DebtValidationError("total_amount debe ser mayor a 0")

    debt = Debt(
        user_id=user_id,
        counterparty_name=counterparty_name,
        direction=direction,
        total_amount=total_amount,
        currency_id=get_currency_by_code(db, currency).id,
        description=description,
    )
    db.add(debt)
    db.flush()  # asigna debt.id sin cerrar la transacción, para poder crear cuotas hijas

    if installment_count:
        if installment_count <= 0:
            raise DebtValidationError("installment_count debe ser mayor a 0")
        if first_due_date is None:
            first_due_date = date.today()

        # El remanente de redondeo cae en la última cuota para que la suma dé
        # exactamente total_amount (en vez de repartir centavos "perdidos").
        base_amount = (total_amount / installment_count).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        allocated = base_amount * (installment_count - 1)
        last_amount = total_amount - allocated

        for i in range(installment_count):
            amount = base_amount if i < installment_count - 1 else last_amount
            due = first_due_date + timedelta(days=frequency_days * i)
            db.add(Installment(debt_id=debt.id, due_date=due, amount=amount))

    db.commit()
    db.refresh(debt)
    return debt


def list_debts_for_user(db: Session, user_id: uuid.UUID, direction: str | None = None) -> list[Debt]:
    stmt = select(Debt).where(Debt.user_id == user_id)
    if direction is not None:
        stmt = stmt.where(Debt.direction == direction)
    stmt = stmt.order_by(Debt.created_at.desc())
    return list(db.scalars(stmt).all())


def get_debt_owned_by_user(db: Session, debt_id: uuid.UUID, user_id: uuid.UUID) -> Debt:
    debt = db.get(Debt, debt_id)
    if debt is None or debt.user_id != user_id:
        raise DebtNotFoundError("Deuda no encontrada")
    return debt


def delete_debt(db: Session, debt_id: uuid.UUID, user_id: uuid.UUID) -> None:
    debt = get_debt_owned_by_user(db, debt_id, user_id)
    db.delete(debt)  # cascade="all, delete-orphan" en la relación borra las cuotas
    db.commit()


def get_debt_summary(db: Session, user_id: uuid.UUID) -> dict[str, Decimal]:
    """Totales simples y explícitos, no clever: por cada deuda, lo pendiente es
    total_amount menos lo ya pagado en cuotas (una deuda sin cuotas cuenta completa,
    ya que no hay forma de marcarla parcialmente pagada)."""
    debts = list_debts_for_user(db, user_id)

    total_owed_by_user = Decimal("0")
    total_owed_to_user = Decimal("0")

    for debt in debts:
        paid = sum((inst.amount for inst in debt.installments if inst.status == "paid"), Decimal("0"))
        remaining = debt.total_amount - paid
        if debt.direction == "owed_by_user":
            total_owed_by_user += remaining
        else:
            total_owed_to_user += remaining

    return {"total_owed_by_user": total_owed_by_user, "total_owed_to_user": total_owed_to_user}
