import uuid
from datetime import date, datetime, time, timezone
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.goals.goal_check_in_model import GoalCheckIn
from app.models.goals.goal_model import Goal
from app.services.goals.errors import GoalNotActiveError, GoalValidationError
from app.services.goals.goal_service import get_goal_owned_by_user


def get_goals_needing_check_in(db: Session, on_date: date) -> list[Goal]:
    """Scan GLOBAL a proposito (sin filtro de usuario) - mismo criterio que
    get_due_installments: listo para un futuro cron aunque hoy se llame on-demand
    desde el mount de GoalsMain.vue (Berry no tiene cron real, ver
    services/currency/rates/cache_refresh.py para el mismo criterio de "chequeo al
    acceder"). Una meta necesita check-in si esta activa, ya paso al menos un mes
    calendario completo desde que se creo (el mes de alta queda exento - pedir un
    check-in el mismo mes que se crea la meta se siente prematuro), y no tiene todavia
    ninguna fila de GoalCheckIn para el mes de on_date."""
    period_month = on_date.replace(day=1)
    period_start = datetime.combine(period_month, time.min, tzinfo=timezone.utc)
    already_checked_in = select(GoalCheckIn.goal_id).where(GoalCheckIn.period_month == period_month)
    stmt = (
        select(Goal)
        .where(Goal.status == "active")
        .where(Goal.created_at < period_start)
        .where(Goal.id.notin_(already_checked_in))
    )
    return list(db.scalars(stmt).all())


def get_goals_needing_check_in_for_user(db: Session, user_id: uuid.UUID, on_date: date) -> list[Goal]:
    return [goal for goal in get_goals_needing_check_in(db, on_date) if goal.user_id == user_id]


def record_check_in(
    db: Session,
    goal_id: uuid.UUID,
    user_id: uuid.UUID,
    amount_saved: Decimal,
    new_target_date: date | None = None,
    note: str | None = None,
) -> GoalCheckIn:
    goal = get_goal_owned_by_user(db, goal_id, user_id)
    if goal.status != "active":
        raise GoalNotActiveError("Solo se puede registrar un check-in sobre una meta activa")
    if new_target_date is not None and new_target_date <= goal.target_date:
        raise GoalValidationError("La nueva fecha debe ser posterior a la fecha actual de la meta")

    amount_saved = Decimal(amount_saved)
    check_in = GoalCheckIn(
        goal_id=goal.id,
        period_month=date.today().replace(day=1),
        amount_saved=amount_saved,
        previous_target_date=goal.target_date if new_target_date else None,
        new_target_date=new_target_date,
        note=note,
    )
    db.add(check_in)

    goal.total_saved += amount_saved
    if new_target_date is not None:
        goal.target_date = new_target_date
    if goal.total_saved >= goal.target_amount:
        goal.status = "completed"
        goal.completed_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(check_in)
    return check_in


def list_check_ins_for_goal(db: Session, goal_id: uuid.UUID, user_id: uuid.UUID) -> list[GoalCheckIn]:
    goal = get_goal_owned_by_user(db, goal_id, user_id)
    return sorted(goal.check_ins, key=lambda check_in: check_in.created_at)


def abandon_goal(db: Session, goal_id: uuid.UUID, user_id: uuid.UUID) -> Goal:
    goal = get_goal_owned_by_user(db, goal_id, user_id)
    if goal.status != "active":
        raise GoalNotActiveError("Solo se puede abandonar una meta activa")
    goal.status = "abandoned"
    db.commit()
    db.refresh(goal)
    return goal
