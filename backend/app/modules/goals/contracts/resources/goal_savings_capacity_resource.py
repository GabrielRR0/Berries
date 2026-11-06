from decimal import Decimal

from pydantic import BaseModel


class GoalSavingsCapacityResource(BaseModel):
    avg_monthly_income: Decimal
    avg_monthly_expense: Decimal
    avg_monthly_available: Decimal
    # False mientras la cuenta no lleva al menos 1 mes calendario completo ANTERIOR
    # al actual (ver get_savings_capacity) - pedido explicito del usuario: con una
    # sola cifra (la del mes en curso, todavia ni terminado) no alcanza para llamarlo
    # "promedio" - un gasto puntual de ese unico mes no es un patron mensual real.
    # El front decide si mostrar o no las advertencias de capacidad segun este flag.
    has_enough_history: bool
