import uuid
from datetime import date, datetime, timezone
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.auth.user_model import User
from app.models.goals.goal_check_in_model import GoalCheckIn
from app.models.goals.goal_model import Goal
from app.schemas.goals.goal_schemas import GoalResponse, GoalType, Status
from app.services.analytics.analytics_service import get_monthly_comparison
from app.services.currency.currency_lookup import get_currency_by_code
from app.services.goals.contribution_calculator import compute_monthly_contribution
from app.services.goals.errors import GoalNotActiveError, GoalNotFoundError, GoalValidationError
from app.services.goals.wallet_commitment_service import validate_and_get_wallet_for_commitment


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


def get_savings_capacity(db: Session, user_id: uuid.UUID, months: int = 3) -> dict[str, Decimal | bool]:
    """Promedio de ingresos/gastos reales de los ultimos `months` meses calendario,
    reusando get_monthly_comparison de analytics_service (ya resuelve la suma sobre
    Transaction.amount, que esta encriptado igual que los campos de Goal). Puramente
    informativo para Metas (ver GoalCard.vue/CreateGoalForm.vue) - nunca bloquea la
    creacion ni edicion de una meta, el usuario mantiene control total.

    Bug real reportado por el usuario: una cuenta recien creada (ej. este mismo mes)
    mostraba un "disponible promedio" absurdamente negativo. get_monthly_comparison
    siempre devuelve `months` entradas (meses vacios en cero incluidos, ver su propio
    docstring), asi que dividir por `len(comparison)` promediaba los movimientos
    reales del UNICO mes que la cuenta lleva existiendo entre 3 meses, 2 de los
    cuales son anteriores a que la cuenta siquiera existiera - de ahi que un gasto
    real de $5510 en el primer mes se mostrara como -$1836.67/mes. El divisor debe
    ser cuantos de esos meses la cuenta ya existia, no el largo fijo de la ventana.

    Segunda vuelta del mismo pedido: aun corrigiendo el divisor, el mes actual todavia
    esta EN CURSO (no terminado) - una sola cifra parcial no es un "promedio" real,
    solo lo que paso hasta ahora en un mes atipico (ej. gastos de arranque de cuenta).

    Tercera vuelta: 1 solo mes anterior completo tampoco alcanza - un ingreso/gasto
    puntual de "esto es lo que ya tenia ahorrado" (si el usuario lo carga como
    transaccion en vez de usar el saldo inicial de la billetera, pensado justamente
    para esto y que nunca entra en este calculo) sigue pareciendo "el promedio" con
    una sola muestra. has_enough_history solo es True con al menos 2 meses
    calendario COMPLETOS anteriores al actual, ademas del actual (3 meses en total) -
    pedido explicito del usuario."""
    comparison = get_monthly_comparison(db, user_id, months=months)
    user = db.get(User, user_id)
    account_created_month = f"{user.created_at.year:04d}-{user.created_at.month:02d}" if user else None
    months_existed = sum(1 for item in comparison if account_created_month is None or item.month >= account_created_month)
    count = months_existed or 1
    avg_income = sum((item.total_income for item in comparison), Decimal("0")) / count
    avg_expense = sum((item.total_expense for item in comparison), Decimal("0")) / count
    return {
        "avg_monthly_income": avg_income,
        "avg_monthly_expense": avg_expense,
        "avg_monthly_available": avg_income - avg_expense,
        "has_enough_history": months_existed >= 3,
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
