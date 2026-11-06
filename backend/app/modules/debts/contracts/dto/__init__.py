"""Lo que ENTRA por HTTP: un modelo por caso."""

from app.modules.debts.contracts.dto.create_debt_dto import CreateDebtDto
from app.modules.debts.contracts.dto.create_debt_payment_dto import CreateDebtPaymentDto
from app.modules.debts.contracts.dto.parse_debt_payment_voice_dto import ParseDebtPaymentVoiceDto

__all__ = [
    "CreateDebtDto",
    "CreateDebtPaymentDto",
    "ParseDebtPaymentVoiceDto",
]
