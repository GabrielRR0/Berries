# controllers/ — goals

Las rutas del módulo, separadas por **quién puede usarlas**. Cada archivo crea su router con el grupo de acceso de su carpeta (lo comprueba `tests/architecture/test_rules.py`) y solo llama a la fachada `services`.

`__init__.py` lista los routers en el orden en que se registran: el que tiene una ruta `/{id}` va último para no tapar a las rutas fijas.

## `private/user/` — cualquier usuario con sesión (`auth_group()`)

- **`goal_check_ins_controller.py`** — `POST /api/goals/{goal_id}/check-ins`, `PATCH /api/goals/{goal_id}/check-ins/{check_in_id}`, `GET /api/goals/{goal_id}/check-ins`
- **`goal_overview_controller.py`** — `GET /api/goals/summary`, `GET /api/goals/wallet-commitments`, `GET /api/goals/savings-capacity`, `GET /api/goals/pending-check-ins`, `POST /api/goals/voice-preview`
- **`goals_controller.py`** — `POST /api/goals`, `GET /api/goals`, `GET /api/goals/{goal_id}`, `PATCH /api/goals/{goal_id}`, `DELETE /api/goals/{goal_id}`, `POST /api/goals/{goal_id}/abandon`
