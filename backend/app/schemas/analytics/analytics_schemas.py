from decimal import Decimal

from pydantic import BaseModel


class PeriodSummaryResponse(BaseModel):
    period: str
    total_income: Decimal
    total_expense: Decimal
    net_savings: Decimal
    # Mismo cálculo (income - expense) pero para el mes calendario inmediatamente
    # anterior — lo que el dashboard usa para mostrar el delta mes contra mes.
    previous_period_net_savings: Decimal


class CategoryBreakdownItem(BaseModel):
    category: str
    total: Decimal
    # 0-100, participación de esta categoría sobre el total de su type+month. 0.0
    # (nunca división por cero) cuando el total del período es 0.
    percentage: float


class MonthlyComparisonItem(BaseModel):
    month: str
    total_income: Decimal
    total_expense: Decimal
    net: Decimal
