from pydantic import BaseModel, Field

from app.modules.categories.contracts.enums import Kind


class CreateCategoryDto(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    kind: Kind
