# Módulo `goals`

Metas de ahorro: aportes, check-ins, capacidad de ahorro y creación por voz.

## Rutas

| Método | Ruta | Acceso |
|---|---|---|
| GET | `/api/goals/summary` | con sesión |
| GET | `/api/goals/wallet-commitments` | con sesión |
| GET | `/api/goals/savings-capacity` | con sesión |
| GET | `/api/goals/pending-check-ins` | con sesión |
| POST | `/api/goals/voice-preview` | con sesión |
| POST | `/api/goals/{goal_id}/check-ins` | con sesión |
| PATCH | `/api/goals/{goal_id}/check-ins/{check_in_id}` | con sesión |
| GET | `/api/goals/{goal_id}/check-ins` | con sesión |
| POST | `/api/goals` | con sesión |
| GET | `/api/goals` | con sesión |
| GET | `/api/goals/{goal_id}` | con sesión |
| PATCH | `/api/goals/{goal_id}` | con sesión |
| DELETE | `/api/goals/{goal_id}` | con sesión |
| POST | `/api/goals/{goal_id}/abandon` | con sesión |

## API pública (`__init__.py`)

Lo único que otros módulos pueden importar: `Goal`, `GoalCheckIn`, `create_goal`, `goals_routers`, `record_check_in`.

## Carpetas

- `contracts/` — lo que entra (`dto/`) y lo que sale (`resources/`)
- `controllers/` — las rutas, por quién puede usarlas
- `models/` — las tablas (SQLAlchemy)
- `services/` — la lógica, con la fachada en `__init__.py`
- `tests/` — pruebas unitarias del módulo
- `errors.py` — los errores del módulo, cada uno con su código HTTP
