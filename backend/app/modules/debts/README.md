# Módulo `debts`

Deudas: lo que el usuario debe o le deben, sus cuotas y sus pagos.

## Rutas

| Método | Ruta | Acceso |
|---|---|---|
| POST | `/api/debts` | con sesión |
| GET | `/api/debts` | con sesión |
| GET | `/api/debts/summary` | con sesión |
| DELETE | `/api/debts/{debt_id}` | con sesión |
| POST | `/api/debts/{debt_id}/installments/{installment_id}/pay` | con sesión |
| POST | `/api/debts/{debt_id}/installments/{installment_id}/unpay` | con sesión |
| POST | `/api/debts/{debt_id}/payments` | con sesión |
| DELETE | `/api/debts/{debt_id}/payments/{payment_id}` | con sesión |
| POST | `/api/debts/{debt_id}/payments/parse-voice` | con sesión |

## API pública (`__init__.py`)

Lo único que otros módulos pueden importar: `Debt`, `DebtPayment`, `Installment`, `create_debt`, `create_debt_payment`, `debts_routers`, `list_debts_for_user`, `mark_installment_paid`.

## Carpetas

- `contracts/` — lo que entra (`dto/`) y lo que sale (`resources/`)
- `controllers/` — las rutas, por quién puede usarlas
- `models/` — las tablas (SQLAlchemy)
- `services/` — la lógica, con la fachada en `__init__.py`
- `tests/` — pruebas unitarias del módulo
- `errors.py` — los errores del módulo, cada uno con su código HTTP
