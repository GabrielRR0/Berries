# controllers/ — currency

Las rutas del módulo, separadas por **quién puede usarlas**. Cada archivo crea su router con el grupo de acceso de su carpeta (lo comprueba `tests/architecture/test_rules.py`) y solo llama a la fachada `services`.

`__init__.py` lista los routers en el orden en que se registran: el que tiene una ruta `/{id}` va último para no tapar a las rutas fijas.

## `private/user/` — cualquier usuario con sesión (`auth_group()`)

- **`currency_controller.py`** — `GET /api/currency/convert`, `GET /api/currency/history`

## `system/` — Vercel Cron con `CRON_SECRET` (`cron_group()`)

- **`cron_controller.py`** — `GET /api/cron/refresh-daily`
