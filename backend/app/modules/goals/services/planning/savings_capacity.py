"""Cuánto puede ahorrar el usuario por mes según sus últimos meses."""

import uuid
from decimal import Decimal

from sqlalchemy.orm import Session

from app.modules.analytics import get_monthly_comparison
from app.modules.auth import User


def get_savings_capacity(db: Session, user_id: uuid.UUID, months: int = 3) -> dict[str, Decimal | bool]:
    """Promedio de ingresos/gastos reales de los ultimos `months` meses calendario,
    reusando get_monthly_comparison de analytics/services (ya resuelve la suma sobre
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
