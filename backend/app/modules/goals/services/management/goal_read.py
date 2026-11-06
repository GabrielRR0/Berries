"""Consultas de metas y la respuesta que se arma para cada una."""

import uuid
from datetime import date
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.auth import User
from app.modules.currency import get_conversion_rate
from app.modules.goals.contracts.enums import Status
from app.modules.goals.contracts.resources import GoalResource
from app.modules.goals.errors import GoalNotFoundError
from app.modules.goals.models.goal_model import Goal
from app.modules.goals.services.planning.contribution_calculator import compute_monthly_contribution


def list_goals_for_user(db: Session, user_id: uuid.UUID, status: Status | None = None) -> list[Goal]:
    stmt = select(Goal).where(Goal.user_id == user_id)
    if status is not None:
        stmt = stmt.where(Goal.status == status)
    stmt = stmt.order_by(Goal.created_at.desc())
    return list(db.scalars(stmt).all())


def get_goal_owned_by_user(db: Session, goal_id: uuid.UUID, user_id: uuid.UUID) -> Goal:
    goal = db.get(Goal, goal_id)
    if goal is None or goal.user_id != user_id:
        raise GoalNotFoundError("Meta no encontrada")
    return goal


def get_goal_summary(db: Session, user_id: uuid.UUID) -> dict[str, Decimal]:
    """Suma simple sobre metas ACTIVAS unicamente - una meta completada o abandonada ya
    no aporta a "cuanto falta reunir en total", mismo criterio de alcance que
    get_debt_summary (que tambien excluye lo que ya no esta pendiente).

    Bug real de la misma familia que el de analytics_service.py: cada Goal puede tener
    su propia moneda (Goal.currency_id), así que sumar total_saved/target_amount crudos
    de metas en monedas distintas mezclaba números sin convertir. Se convierte cada
    meta a User.default_currency antes de sumar - con la tasa EN VIVO (get_conversion_rate,
    no _at): a diferencia de una Transaction ya ocurrida, una meta es un valor que
    existe HOY (cuánto llevás ahorrado / cuánto falta ahora), no un hecho histórico que
    deba congelarse - mismo criterio que un balance de wallet."""
    user = db.get(User, user_id)
    target_currency = user.default_currency if user else "USD"
    goals = list_goals_for_user(db, user_id, status="active")

    total_saved = Decimal("0")
    total_target = Decimal("0")
    for goal in goals:
        rate = Decimal("1") if goal.currency == target_currency else get_conversion_rate(db, goal.currency, target_currency)
        total_saved += goal.total_saved * rate
        total_target += goal.target_amount * rate
    return {"total_saved": total_saved, "total_target": total_target}


def _last_check_in_postponed(goal: Goal) -> bool:
    if not goal.check_ins:
        return False
    latest = max(goal.check_ins, key=lambda check_in: check_in.created_at)
    return latest.new_target_date is not None


def build_goal_response(goal: Goal, today: date | None = None) -> GoalResource:
    """GoalResource tiene 2 campos calculados que no son atributos reales del modelo
    (suggested_monthly_contribution, last_check_in_postponed) - se arma a mano en vez
    de GoalResource.model_validate(goal), que solo lee atributos que existen tal cual
    en el objeto ORM."""
    today = today or date.today()
    return GoalResource(
        id=goal.id,
        user_id=goal.user_id,
        title=goal.title,
        target_amount=goal.target_amount,
        currency=goal.currency,
        target_date=goal.target_date,
        total_saved=goal.total_saved,
        status=goal.status,
        goal_type=goal.goal_type,
        created_at=goal.created_at,
        completed_at=goal.completed_at,
        suggested_monthly_contribution=compute_monthly_contribution(
            goal.target_amount, goal.total_saved, goal.target_date, today
        ),
        last_check_in_postponed=_last_check_in_postponed(goal),
    )
