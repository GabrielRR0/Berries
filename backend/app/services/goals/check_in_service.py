import uuid
from datetime import date, datetime, time, timezone
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.goals.goal_check_in_model import GoalCheckIn
from app.models.goals.goal_model import Goal
from app.services.goals.errors import GoalNotActiveError, GoalNotFoundError, GoalValidationError
from app.services.goals.goal_service import get_goal_owned_by_user
from app.services.goals.wallet_commitment_service import validate_and_get_wallet_for_commitment


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
    wallet_id: uuid.UUID | None = None,
) -> GoalCheckIn:
    goal = get_goal_owned_by_user(db, goal_id, user_id)
    if goal.status != "active":
        raise GoalNotActiveError("Solo se puede registrar un check-in sobre una meta activa")
    if new_target_date is not None and new_target_date <= goal.target_date:
        raise GoalValidationError("La nueva fecha debe ser posterior a la fecha actual de la meta")

    amount_saved = Decimal(amount_saved)
    # Reserva BLANDA (pedido explicito del usuario, confirmado) - ver
    # wallet_commitment_service.py: nunca mueve plata real, solo valida que la
    # billetera elegida tenga disponible suficiente.
    if wallet_id is not None:
        validate_and_get_wallet_for_commitment(db, user_id, wallet_id, goal.currency, amount_saved)

    check_in = GoalCheckIn(
        goal_id=goal.id,
        period_month=date.today().replace(day=1),
        amount_saved=amount_saved,
        previous_target_date=goal.target_date if new_target_date else None,
        new_target_date=new_target_date,
        note=note,
        wallet_id=wallet_id,
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


def update_check_in(
    db: Session,
    goal_id: uuid.UUID,
    check_in_id: uuid.UUID,
    user_id: uuid.UUID,
    wallet_id: uuid.UUID | None,
    note: str | None,
) -> GoalCheckIn:
    """Edita SOLO la fuente de un aporte ya existente (a que billetera esta enlazado, y
    su nota) - pedido explicito del usuario: un aporte que quedo como "ingreso futuro"
    se puede re-enlazar a una billetera real una vez que esa plata efectivamente llego.
    Nunca toca amount_saved/period_month/new_target_date - reemplazo completo de
    wallet_id/note (ver GoalCheckInUpdateRequest). No exige que la meta siga activa:
    recalificar de donde salio una plata vieja tiene sentido aunque la meta ya se haya
    completado o abandonado."""
    goal = get_goal_owned_by_user(db, goal_id, user_id)
    check_in = db.get(GoalCheckIn, check_in_id)
    if check_in is None or check_in.goal_id != goal.id:
        raise GoalNotFoundError("Aporte no encontrado")

    if wallet_id is not None:
        validate_and_get_wallet_for_commitment(
            db, user_id, wallet_id, goal.currency, check_in.amount_saved, exclude_check_in_id=check_in.id
        )

    check_in.wallet_id = wallet_id
    check_in.note = note
    db.commit()
    db.refresh(check_in)
    return check_in


def abandon_goal(db: Session, goal_id: uuid.UUID, user_id: uuid.UUID) -> Goal:
    goal = get_goal_owned_by_user(db, goal_id, user_id)
    if goal.status != "active":
        raise GoalNotActiveError("Solo se puede abandonar una meta activa")
    goal.status = "abandoned"
    db.commit()
    db.refresh(goal)
    return goal
