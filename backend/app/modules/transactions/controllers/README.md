# controllers/ — transactions

Las rutas del módulo, separadas por **quién puede usarlas**. Cada archivo crea su router con el grupo de acceso de su carpeta (lo comprueba `tests/architecture/test_rules.py`) y solo llama a la fachada `services`.

`__init__.py` lista los routers en el orden en que se registran: el que tiene una ruta `/{id}` va último para no tapar a las rutas fijas.

## `private/user/` — cualquier usuario con sesión (`auth_group()`)

- **`drafts_controller.py`** — `GET /api/transactions/drafts`, `POST /api/transactions/drafts/{draft_id}/confirm`, `POST /api/transactions/drafts/bulk`, `PATCH /api/transactions/drafts/{draft_id}`, `POST /api/transactions/drafts/{draft_id}/confirm-transfer`, `POST /api/transactions/drafts/{draft_id}/discard`
- **`transactions_controller.py`** — `POST /api/transactions`, `POST /api/transactions/bulk`, `POST /api/transactions/duplicates`, `GET /api/transactions`, `PATCH /api/transactions/{transaction_id}`, `DELETE /api/transactions/{transaction_id}`
