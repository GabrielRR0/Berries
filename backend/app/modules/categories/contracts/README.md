# contracts/ — categories

Todo lo que entra y sale por HTTP, y nada más. No importa de controllers ni de services (solo al revés).

## `dto/` — lo que ENTRA (body y query, validado por Pydantic)

- `create_category_dto.py` — `CreateCategoryDto`

## `resources/` — lo que SALE (una clase por respuesta)

- `category_resource.py` — `CategoryResource`

## `enums.py`

Valores fijos que comparten la entrada y la salida: `Kind`.
