from pydantic import BaseModel

from app.modules.currency.contracts.resources.rate_history_point_resource import RateHistoryPointResource


class RateHistoryResource(BaseModel):
    code: str
    quote: str
    points: list[RateHistoryPointResource]
