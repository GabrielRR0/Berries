# controllers/ — wallets

Las rutas del módulo, separadas por **quién puede usarlas**. Cada archivo crea su router con el grupo de acceso de su carpeta (lo comprueba `tests/architecture/test_rules.py`) y solo llama a la fachada `services`.

`__init__.py` lista los routers en el orden en que se registran: el que tiene una ruta `/{id}` va último para no tapar a las rutas fijas.

## `private/user/` — cualquier usuario con sesión (`auth_group()`)

- **`transfers_controller.py`** — `POST /api/wallets/transfer`, `PATCH /api/wallets/transfer/{transfer_id}`
- **`wallets_controller.py`** — `POST /api/wallets`, `GET /api/wallets`, `DELETE /api/wallets/{wallet_id}`
