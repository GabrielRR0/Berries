# Módulo `analytics`

Análisis: resumen del período, gastos por categoría, series por día/semana/mes, comparativas, patrones semanales, desglose por billetera y recomendaciones.

## Rutas

| Método | Ruta | Acceso |
|---|---|---|
| GET | `/api/analytics/summary` | con sesión |
| GET | `/api/analytics/categories` | con sesión |
| GET | `/api/analytics/monthly` | con sesión |
| GET | `/api/analytics/categories/trend` | con sesión |
| GET | `/api/analytics/timeline` | con sesión |
| GET | `/api/analytics/compare` | con sesión |
| GET | `/api/analytics/patterns` | con sesión |
| GET | `/api/analytics/wallets` | con sesión |
| GET | `/api/analytics/top-transactions` | con sesión |
| GET | `/api/analytics/insights` | con sesión |

## API pública (`__init__.py`)

Lo único que otros módulos pueden importar: `analytics_routers`, `get_monthly_comparison`.

## Carpetas

- `contracts/` — lo que entra (`dto/`) y lo que sale (`resources/`)
- `controllers/` — las rutas, por quién puede usarlas
- `services/` — la lógica, con la fachada en `__init__.py`
- `tests/` — pruebas unitarias del módulo
- `utils/` — funciones puras que comparten varios services
- `errors.py` — los errores del módulo, cada uno con su código HTTP
