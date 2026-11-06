"""Importa todos los modelos para que Base.metadata quede completo antes de la primera
consulta (lo usan la app al arrancar, Alembic y las pruebas). Un módulo con tablas
nuevas se agrega acá."""

from app.modules.auth import User  # noqa: F401
from app.modules.categories import Category, HiddenCategory  # noqa: F401
from app.modules.currency import Currency, ExchangeRate  # noqa: F401
from app.modules.debts import Debt, DebtPayment, Installment  # noqa: F401
from app.modules.goals import Goal, GoalCheckIn  # noqa: F401
from app.modules.transactions import Transaction, TransactionDraft  # noqa: F401
from app.modules.wallets import Wallet  # noqa: F401
