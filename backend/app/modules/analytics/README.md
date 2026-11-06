# Módulo `analytics`

Análisis: resumen del período, gastos por categoría y comparaciones mensuales.

## Rutas

| Método | Ruta | Acceso |
|---|---|---|
| GET | `/api/analytics/summary` | con sesión |
| GET | `/api/analytics/categories` | con sesión |
| GET | `/api/analytics/monthly` | con sesión |
| GET | `/api/analytics/categories/trend` | con sesión |

## API pública (`__init__.py`)

Lo único que otros módulos pueden importar: `analytics_routers`, `get_monthly_comparison`.

## Carpetas

- `contracts/` — lo que entra (`dto/`) y lo que sale (`resources/`)
- `controllers/` — las rutas, por quién puede usarlas
- `services/` — la lógica, con la fachada en `__init__.py`
- `tests/` — pruebas unitarias del módulo
- `utils/` — funciones puras que comparten varios services
- `errors.py` — los errores del módulo, cada uno con su código HTTP
