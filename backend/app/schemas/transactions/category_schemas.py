import uuid
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

Kind = Literal["income", "expense", "both"]


class CategoryCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    kind: Kind


class CategoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    kind: Kind
    # Calculados (no atributos reales del modelo) - ver category_service.build_category_response.
    # is_default: true => Category.user_id is None (compartida, no borrable, solo ocultable).
    # is_hidden: true => ESTE usuario la ocultó (siempre false salvo con ?include_hidden=true,
    # ver categories_router.py - la pantalla de Ajustes es la única que necesita ver esto).
    is_default: bool
    is_hidden: bool
