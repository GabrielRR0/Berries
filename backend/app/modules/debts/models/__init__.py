"""Tablas del módulo."""

from app.modules.debts.models.debt_model import Debt
from app.modules.debts.models.debt_payment_model import DebtPayment
from app.modules.debts.models.installment_model import Installment

__all__ = ["Debt", "DebtPayment", "Installment"]
