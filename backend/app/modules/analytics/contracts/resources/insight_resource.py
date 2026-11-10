from decimal import Decimal

from pydantic import BaseModel

from app.modules.analytics.contracts.enums import InsightLevel


class InsightResource(BaseModel):
    # Identifica la regla; el frontend arma el texto y la acción a partir del código.
    code: str
    level: InsightLevel
    category: str | None = None
    amount: Decimal | None = None
    reference_amount: Decimal | None = None
    percent: float | None = None
    # 0 = lunes ... 6 = domingo.
    weekday: int | None = None
