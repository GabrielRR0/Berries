# services/ — goals

La lógica de negocio. `__init__.py` es la **fachada**: los controllers, los comandos y la API pública del módulo solo hablan con ella, así un archivo puede partirse o moverse sin tocar a quien la usa.

Los services lanzan los errores de `../errors.py` (cada uno con su código HTTP) sin saber de HTTP.

## `check_ins/`

- **`check_in_service.py`** — Aportes mensuales (check-ins) a una meta, y abandonar una meta.

## `management/`

- **`goal_read.py`** — Consultas de metas y la respuesta que se arma para cada una.
- **`goal_write.py`** — Crear, editar y borrar metas.

## `planning/`

- **`contribution_calculator.py`** — Cuánto falta reunir por mes para llegar a la fecha objetivo.
- **`savings_capacity.py`** — Cuánto puede ahorrar el usuario por mes según sus últimos meses.
- **`wallet_commitment_service.py`** — Cuánto de cada billetera está apartado para metas activas, y el saldo disponible.

## `voice/`

- **`goal_entity_parser.py`** — Parser de titulo/monto/fecha objetivo para metas dichas en texto libre (español).
- **`goal_voice_service.py`** — Entender una meta dicha por voz para precargar el formulario (no guarda nada).
