# controllers/ — debts

Las rutas del módulo, separadas por **quién puede usarlas**. Cada archivo crea su router con el grupo de acceso de su carpeta (lo comprueba `tests/architecture/test_rules.py`) y solo llama a la fachada `services`.

`__init__.py` lista los routers en el orden en que se registran: el que tiene una ruta `/{id}` va último para no tapar a las rutas fijas.

## `private/user/` — cualquier usuario con sesión (`auth_group()`)

- **`debt_payments_controller.py`** — `POST /api/debts/{debt_id}/payments`, `DELETE /api/debts/{debt_id}/payments/{payment_id}`, `POST /api/debts/{debt_id}/payments/parse-voice`
- **`debts_controller.py`** — `POST /api/debts`, `GET /api/debts`, `GET /api/debts/summary`, `DELETE /api/debts/{debt_id}`
- **`installments_controller.py`** — `POST /api/debts/{debt_id}/installments/{installment_id}/pay`, `POST /api/debts/{debt_id}/installments/{installment_id}/unpay`
