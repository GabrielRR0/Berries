import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict

from app.modules.debts.contracts.resources.debt_payment_resource import DebtPaymentResource
from app.modules.debts.contracts.resources.installment_resource import InstallmentResource


class DebtResource(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    counterparty_name: str
    direction: str
    total_amount: Decimal
    currency: str
    description: str | None
    created_at: datetime
    installments: list[InstallmentResource] = []
    payments: list[DebtPaymentResource] = []
    # Calculados por debt_service.build_debt_response (no son campos reales del
    # modelo) - cuotas pagadas + abonos registrados, y lo que falta de total_amount.
    amount_paid: Decimal
    remaining_amount: Decimal
