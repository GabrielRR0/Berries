# Importa todos los modelos de cada dominio para que Base.metadata quede completo
# (Alembic autogenerate y create_all dependen de este import agregador).
from app.models.auth.user_model import User  # noqa: F401
from app.models.currency.currency_model import Currency  # noqa: F401
from app.models.currency.exchange_rate_model import ExchangeRate  # noqa: F401
from app.models.debts.debt_model import Debt  # noqa: F401
from app.models.debts.debt_payment_model import DebtPayment  # noqa: F401
from app.models.debts.installment_model import Installment  # noqa: F401
from app.models.goals.goal_check_in_model import GoalCheckIn  # noqa: F401
from app.models.goals.goal_model import Goal  # noqa: F401
from app.models.transactions.category_model import Category  # noqa: F401
from app.models.transactions.hidden_category_model import HiddenCategory  # noqa: F401
from app.models.transactions.transaction_draft_model import TransactionDraft  # noqa: F401
from app.models.transactions.transaction_model import Transaction  # noqa: F401
from app.models.wallets.wallet_model import Wallet  # noqa: F401
