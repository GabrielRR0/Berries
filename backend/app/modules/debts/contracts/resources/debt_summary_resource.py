from decimal import Decimal

from pydantic import BaseModel


class DebtSummaryResource(BaseModel):
    total_owed_by_user: Decimal
    total_owed_to_user: Decimal
