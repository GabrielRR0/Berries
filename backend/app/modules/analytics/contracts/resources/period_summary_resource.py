from decimal import Decimal

from pydantic import BaseModel


class PeriodSummaryResource(BaseModel):
    period: str
    total_income: Decimal
    total_expense: Decimal
    net_savings: Decimal
    # Mismo cálculo (income - expense) pero para el mes calendario inmediatamente
    # anterior — lo que el dashboard usa para mostrar el delta mes contra mes.
    previous_period_net_savings: Decimal
