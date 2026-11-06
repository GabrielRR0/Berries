# services/ — wallets

La lógica de negocio. `__init__.py` es la **fachada**: los controllers, los comandos y la API pública del módulo solo hablan con ella, así un archivo puede partirse o moverse sin tocar a quien la usa.

Los services lanzan los errores de `../errors.py` (cada uno con su código HTTP) sin saber de HTTP.

- **`wallet_service.py`** — Crear, listar y borrar billeteras.

## `transfers/`

- **`transfer_create.py`** — Crear una transferencia entre dos billeteras del mismo usuario.
- **`transfer_rates.py`** — Tasa implícita de una transferencia entre monedas distintas (se guarda en ExchangeRate).
- **`transfer_update.py`** — Editar monto, comisión o fecha de una transferencia existente.
