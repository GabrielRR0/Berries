# Módulo `transactions`

Movimientos (ingresos y gastos) y borradores por revisar (voz, foto, capturas).

## Dos temas

- `services/ledger/` — los movimientos: cada alta, edición o borrado aplica (o revierte)
  su efecto en el saldo de la billetera en la misma unidad de trabajo. Borrar una pata
  de una transferencia borra las dos y revierte ambas billeteras.
- `services/drafts/` — borradores: un movimiento que viene de voz, de una foto o de
  capturas, antes de que el usuario lo confirme. Voz y foto comparten el mismo parser
  (`drafts/entity_parser.py`).

## Rutas

| Método | Ruta | Acceso |
|---|---|---|
| GET | `/api/transactions/drafts` | con sesión |
| POST | `/api/transactions/drafts/{draft_id}/confirm` | con sesión |
| POST | `/api/transactions/drafts/bulk` | con sesión |
| PATCH | `/api/transactions/drafts/{draft_id}` | con sesión |
| POST | `/api/transactions/drafts/{draft_id}/confirm-transfer` | con sesión |
| POST | `/api/transactions/drafts/{draft_id}/discard` | con sesión |
| POST | `/api/transactions` | con sesión |
| POST | `/api/transactions/bulk` | con sesión |
| POST | `/api/transactions/duplicates` | con sesión |
| GET | `/api/transactions` | con sesión |
| PATCH | `/api/transactions/{transaction_id}` | con sesión |
| DELETE | `/api/transactions/{transaction_id}` | con sesión |

## API pública (`__init__.py`)

Lo único que otros módulos pueden importar: `DraftResource`, `Transaction`, `TransactionDraft`, `TransactionValidationError`, `backfill_reference_amounts`, `backfill_reference_amounts_command`, `create_draft`, `create_transaction`, `create_transactions_bulk`, `delete_transaction`, `detect_full_balance_wallet`, `extract_currency`, `list_transactions_for_user`, `parse_transaction_entities`, `seal_import_key`, `transactions_routers`.

## Carpetas

- `commands/` — comandos de `manage.py`; cada uno solo llama a la fachada
- `contracts/` — lo que entra (`dto/`) y lo que sale (`resources/`)
- `controllers/` — las rutas, por quién puede usarlas
- `models/` — las tablas (SQLAlchemy)
- `services/` — la lógica, con la fachada en `__init__.py`
- `tests/` — pruebas unitarias del módulo
- `utils/` — funciones puras que comparten varios services
- `errors.py` — los errores del módulo, cada uno con su código HTTP
