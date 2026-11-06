import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class UserResource(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    display_name: str | None
    default_currency: str
    created_at: datetime
