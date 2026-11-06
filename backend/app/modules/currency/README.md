# Módulo `currency`

Monedas y tasas de cambio: catálogo, conversión, historial y refresco diario.

## Regla clave: saldos a la tasa de hoy, movimientos a la tasa de su día

Un saldo ("¿cuánto vale esto ahora?") se convierte siempre a la tasa vigente
(`convert`, `get_conversion_rate`). Un movimiento ya ocurrido ("¿cuánto valía esa
vez?") se congela a la tasa del día en que pasó (`convert_at`,
`reference_fields_in_usd`). Para una moneda con inflación fuerte (VEF, COP, ARS) las dos
respuestas no coinciden a propósito; no "simplificar". Detalle en
`services/conversion_service.py`.

La serie del bolívar se mantiene completa sola: `history/vef_history.py` trae el
histórico real del BCV cuando falta un día, y el cron diario (`/api/cron/refresh-daily`)
refresca todas las monedas en uso.

## Rutas

| Método | Ruta | Acceso |
|---|---|---|
| GET | `/api/currency/convert` | con sesión |
| GET | `/api/currency/history` | con sesión |
| GET | `/api/cron/refresh-daily` | Vercel Cron (`CRON_SECRET`) |

## API pública (`__init__.py`)

Lo único que otros módulos pueden importar: `Currency`, `ExchangeRate`, `SUPPORTED_CURRENCIES`, `UnsupportedCurrencyError`, `audit_vef_rates`, `backfill_historical_vef_rates`, `backfill_vef_rate_history_command`, `check_rates_command`, `cron_routers`, `currencies_are_equivalent`, `currency_routers`, `get_conversion_rate`, `get_currency_by_code`, `reference_fields_in_usd`, `reset_vef_history_guard`.

## Carpetas

- `commands/` — comandos de `manage.py`; cada uno solo llama a la fachada
- `contracts/` — lo que entra (`dto/`) y lo que sale (`resources/`)
- `controllers/` — las rutas, por quién puede usarlas
- `models/` — las tablas (SQLAlchemy)
- `services/` — la lógica, con la fachada en `__init__.py`
- `tests/` — pruebas unitarias del módulo
- `utils/` — funciones puras que comparten varios services
- `errors.py` — los errores del módulo, cada uno con su código HTTP
