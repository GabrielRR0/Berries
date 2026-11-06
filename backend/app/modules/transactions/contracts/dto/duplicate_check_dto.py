from pydantic import BaseModel, Field


class DuplicateCheckDto(BaseModel):
    keys: list[str] = Field(max_length=300)
