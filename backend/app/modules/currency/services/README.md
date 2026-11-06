# services/ — currency

La lógica de negocio. `__init__.py` es la **fachada**: los controllers, los comandos y la API pública del módulo solo hablan con ella, así un archivo puede partirse o moverse sin tocar a quien la usa.

Los services lanzan los errores de `../errors.py` (cada uno con su código HTTP) sin saber de HTTP.

- **`conversion_service.py`** — Conversión de moneda.
- **`currency_lookup.py`** — Resolver un código de moneda ("USD") a su fila del catálogo.

## `history/`

- **`rate_history.py`** — Serie de tasas guardadas de una moneda, para el gráfico de historial.
- **`vef_history.py`** — Mantiene completa la serie histórica real de la tasa del bolívar (BCV).
- **`vef_rate_audit.py`** — Auditoría de solo lectura: tasas del bolívar y valores de referencia que se apartan de la serie real.

## `rates/`

- **`cache_refresh.py`** — Tasa vigente (con refresco a pedido) y tasa de una fecha pasada.
- **`crypto_rate_client.py`** — Cliente de tasas cripto (USDT).
- **`daily_refresh.py`** — Refresco diario de las tasas de todas las monedas en uso (lo dispara el cron de Vercel).
- **`fiat_rate_client.py`** — Cliente de tasas fiat (Open Exchange Rates).
- **`rate_sanity.py`** — Chequeo de sensatez: descarta saltos de tasa imposibles.
- **`venezuela_rate_client.py`** — Cliente de la tasa oficial del bolívar (dolarapi.com), en vivo e histórica.
