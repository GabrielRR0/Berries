"""Deudas: lo que el usuario debe o le deben, sus cuotas y sus pagos.

Lo único que otros módulos pueden importar (ver app/common/modules/public_api.py).
"""

from typing import TYPE_CHECKING

from app.common.modules import public_api

if TYPE_CHECKING:
    from app.modules.debts.controllers import debts_routers
    from app.modules.debts.models import Debt, DebtPayment, Installment
    from app.modules.debts.services import create_debt, create_debt_payment, list_debts_for_user, mark_installment_paid

__getattr__, __dir__, __all__ = public_api(__name__, __file__)
