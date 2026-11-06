from pydantic import BaseModel


class RefreshDailyResource(BaseModel):
    refreshed_currencies: list[str]
