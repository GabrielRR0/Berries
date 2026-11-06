from pydantic import BaseModel


class GoogleCheckDto(BaseModel):
    id_token: str
