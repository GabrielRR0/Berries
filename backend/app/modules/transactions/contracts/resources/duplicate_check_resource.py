from pydantic import BaseModel


class DuplicateCheckResource(BaseModel):
    # Las claves enviadas que ya corresponden a un movimiento registrado.
    duplicates: list[str]
