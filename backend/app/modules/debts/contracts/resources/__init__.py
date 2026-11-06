"""Lo que SALE por HTTP: un modelo por respuesta."""

from app.modules.debts.contracts.resources.debt_payment_resource import DebtPaymentResource
from app.modules.debts.contracts.resources.debt_payment_voice_parse_resource import DebtPaymentVoiceParseResource
from app.modules.debts.contracts.resources.debt_resource import DebtResource
from app.modules.debts.contracts.resources.debt_summary_resource import DebtSummaryResource
from app.modules.debts.contracts.resources.installment_resource import InstallmentResource

__all__ = [
    "DebtPaymentResource",
    "DebtPaymentVoiceParseResource",
    "DebtResource",
    "DebtSummaryResource",
    "InstallmentResource",
]
