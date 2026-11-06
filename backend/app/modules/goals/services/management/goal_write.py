"""Crear, editar y borrar metas."""

import uuid
from datetime import date, datetime, timezone
from decimal import Decimal

from sqlalchemy.orm import Session

from app.modules.currency import get_currency_by_code
from app.modules.goals.contracts.enums import GoalType
from app.modules.goals.errors import GoalNotActiveError, GoalValidationError
from app.modules.goals.models.goal_check_in_model import GoalCheckIn
from app.modules.goals.models.goal_model import Goal
from app.modules.goals.services.management.goal_read import get_goal_owned_by_user
from app.modules.goals.services.planning.wallet_commitment_service import validate_and_get_wallet_for_commitment


def create_goal(
    db: Session,
    user_id: uuid.UUID,
    title: str,
    target_amount: Decimal,
    currency: str,
    target_date: date,
    goal_type: GoalType = "custom",
    initial_amount: Decimal = Decimal("0"),
    initial_amount_note: str | None = None,
    initial_amount_wallet_id: uuid.UUID | None = None,
) -> Goal:
    target_amount = Decimal(target_amount)
    if target_amount <= 0:
        raise GoalValidationError("target_amount debe ser mayor a 0")
    if target_date <= date.today():
        raise GoalValidationError("target_date debe ser una fecha futura")

    initial_amount = Decimal(initial_amount)
    if initial_amount < 0:
        raise GoalValidationError("initial_amount no puede ser negativo")

    currency_row = get_currency_by_code(db, currency)

    # Validar ANTES de crear nada - pedido explicito del usuario: "de donde lo voy a
    # sacar, puede ser de alguna billetera... si no tengo dinero en esa billetera no
    # se podria enlazar". Reserva BLANDA (confirmado con el usuario): nunca se
    # descuenta wallet.balance ni se crea una Transaction, solo se valida que la
    # billetera elegida tenga DISPONIBLE suficiente (su saldo menos lo ya comprometido
    # en otras metas activas).
    if initial_amount > 0 and initial_amount_wallet_id is not None:
        validate_and_get_wallet_for_commitment(db, user_id, initial_amount_wallet_id, currency_row.code, initial_amount)

    goal = Goal(
        user_id=user_id,
        title=title,
        target_amount=target_amount,
        currency_id=currency_row.id,
        target_date=target_date,
        total_saved=initial_amount,
        goal_type=goal_type,
    )
    # Mismo criterio de completado instantaneo que record_check_in/update_goal: si lo
    # que ya tenia alcanza o supera el objetivo, la meta nace completada.
    if initial_amount >= target_amount:
        goal.status = "completed"
        goal.completed_at = datetime.now(timezone.utc)
    db.add(goal)
    db.flush()

    # El monto inicial queda como el primer GoalCheckIn de la meta (no solo un
    # numero en total_saved) para que el detalle opcional ("si vendo mi laptop u
    # otras pertenencias") tenga donde guardarse - mismo campo "note" que un
    # check-in normal (ver record_check_in en check_in_service.py).
    if initial_amount > 0:
        db.add(
            GoalCheckIn(
                goal_id=goal.id,
                period_month=date.today().replace(day=1),
                amount_saved=initial_amount,
                note=initial_amount_note,
                wallet_id=initial_amount_wallet_id,
            )
        )

    db.commit()
    db.refresh(goal)
    return goal


def update_goal(
    db: Session,
    goal_id: uuid.UUID,
    user_id: uuid.UUID,
    title: str,
    target_amount: Decimal,
    currency: str,
    target_date: date,
) -> Goal:
    """Edicion silenciosa de los datos de una meta activa - a diferencia de posponer via
    check-in (record_check_in), corregir titulo/monto/moneda/fecha desde "editar" no
    genera ninguna fila de historial: es un ajuste de los datos, no un evento a
    registrar. Solo sobre metas activas, mismo criterio que abandon_goal."""
    goal = get_goal_owned_by_user(db, goal_id, user_id)
    if goal.status != "active":
        raise GoalNotActiveError("Solo se puede editar una meta activa")

    target_amount = Decimal(target_amount)
    if target_amount <= 0:
        raise GoalValidationError("target_amount debe ser mayor a 0")
    if target_date <= date.today():
        raise GoalValidationError("target_date debe ser una fecha futura")

    goal.title = title
    goal.target_amount = target_amount
    goal.currency_id = get_currency_by_code(db, currency).id
    goal.target_date = target_date

    # Bajar el monto objetivo por debajo de lo ya reunido completa la meta al
    # instante - mismo chequeo que record_check_in, sin caso especial nuevo.
    if goal.total_saved >= goal.target_amount:
        goal.status = "completed"
        goal.completed_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(goal)
    return goal


def delete_goal(db: Session, goal_id: uuid.UUID, user_id: uuid.UUID) -> None:
    goal = get_goal_owned_by_user(db, goal_id, user_id)
    db.delete(goal)  # cascade="all, delete-orphan" en la relacion borra el historial
    db.commit()
