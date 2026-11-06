# Importa todos los modelos de cada dominio para que Base.metadata quede completo
# (Alembic autogenerate y create_all dependen de este import agregador).
from app.modules.auth import User  # noqa: F401
from app.modules.currency import Currency  # noqa: F401
from app.modules.currency import ExchangeRate  # noqa: F401
from app.modules.debts import Debt  # noqa: F401
from app.modules.debts import DebtPayment  # noqa: F401
from app.modules.debts import Installment  # noqa: F401
from app.modules.goals import GoalCheckIn  # noqa: F401
from app.modules.goals import Goal  # noqa: F401
from app.modules.categories import Category  # noqa: F401
from app.modules.categories import HiddenCategory  # noqa: F401
from app.modules.transactions import TransactionDraft  # noqa: F401
from app.modules.transactions import Transaction  # noqa: F401
from app.modules.wallets import Wallet  # noqa: F401
