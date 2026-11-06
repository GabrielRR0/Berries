"""Deudas: lo que el usuario debe o le deben, sus cuotas y sus pagos.

Lo único que otros módulos pueden importar (ver app/common/modules/public_api.py).
"""

from typing import TYPE_CHECKING

from app.common.modules import public_api

if TYPE_CHECKING:
    from app.modules.debts.models.debt_model import Debt
    from app.modules.debts.models.debt_payment_model import DebtPayment
    from app.modules.debts.models.installment_model import Installment
    from app.modules.debts.services.debt_payment_service import create_debt_payment
    from app.modules.debts.services.debt_service import create_debt, list_debts_for_user
    from app.modules.debts.services.installment_service import mark_installment_paid

__getattr__, __dir__, __all__ = public_api(__name__, __file__)
