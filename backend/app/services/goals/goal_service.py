import uuid
from datetime import date, datetime, timezone
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.goals.goal_model import Goal
from app.schemas.goals.goal_schemas import GoalResponse, GoalType, Status
from app.services.analytics.analytics_service import get_monthly_comparison
from app.services.currency.currency_lookup import get_currency_by_code
from app.services.goals.contribution_calculator import compute_monthly_contribution
from app.services.goals.errors import GoalNotActiveError, GoalNotFoundError, GoalValidationError


def create_goal(
    db: Session,
    user_id: uuid.UUID,
    title: str,
    target_amount: Decimal,
    currency: str,
    target_date: date,
    goal_type: GoalType = "custom",
) -> Goal:
    target_amount = Decimal(target_amount)
    if target_amount <= 0:
        raise GoalValidationError("target_amount debe ser mayor a 0")
    if target_date <= date.today():
        raise GoalValidationError("target_date debe ser una fecha futura")

    goal = Goal(
        user_id=user_id,
        title=title,
        target_amount=target_amount,
        currency_id=get_currency_by_code(db, currency).id,
        target_date=target_date,
        total_saved=Decimal("0"),
        goal_type=goal_type,
    )
    db.add(goal)
    db.commit()
    db.refresh(goal)
    return goal


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


def get_goal_summary(db: Session, user_id: uuid.UUID) -> dict[str, Decimal]:
    """Suma simple sobre metas ACTIVAS unicamente - una meta completada o abandonada ya
    no aporta a "cuanto falta reunir en total", mismo criterio de alcance que
    get_debt_summary (que tambien excluye lo que ya no esta pendiente)."""
    goals = list_goals_for_user(db, user_id, status="active")
    total_saved = sum((g.total_saved for g in goals), Decimal("0"))
    total_target = sum((g.target_amount for g in goals), Decimal("0"))
    return {"total_saved": total_saved, "total_target": total_target}


def get_savings_capacity(db: Session, user_id: uuid.UUID, months: int = 3) -> dict[str, Decimal]:
    """Promedio de ingresos/gastos reales de los ultimos `months` meses calendario,
    reusando get_monthly_comparison de analytics_service (ya resuelve la suma sobre
    Transaction.amount, que esta encriptado igual que los campos de Goal). Puramente
    informativo para Metas (ver GoalCard.vue/CreateGoalForm.vue) - nunca bloquea la
    creacion ni edicion de una meta, el usuario mantiene control total."""
    comparison = get_monthly_comparison(db, user_id, months=months)
    count = len(comparison) or 1
    avg_income = sum((item.total_income for item in comparison), Decimal("0")) / count
    avg_expense = sum((item.total_expense for item in comparison), Decimal("0")) / count
    return {
        "avg_monthly_income": avg_income,
        "avg_monthly_expense": avg_expense,
        "avg_monthly_available": avg_income - avg_expense,
    }


def _last_check_in_postponed(goal: Goal) -> bool:
    if not goal.check_ins:
        return False
    latest = max(goal.check_ins, key=lambda check_in: check_in.created_at)
    return latest.new_target_date is not None


def build_goal_response(goal: Goal, today: date | None = None) -> GoalResponse:
    """GoalResponse tiene 2 campos calculados que no son atributos reales del modelo
    (suggested_monthly_contribution, last_check_in_postponed) - se arma a mano en vez
    de GoalResponse.model_validate(goal), que solo lee atributos que existen tal cual
    en el objeto ORM."""
    today = today or date.today()
    return GoalResponse(
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
