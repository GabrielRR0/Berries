# services/ — transactions

La lógica de negocio. `__init__.py` es la **fachada**: los controllers, los comandos y la API pública del módulo solo hablan con ella, así un archivo puede partirse o moverse sin tocar a quien la usa.

Los services lanzan los errores de `../errors.py` (cada uno con su código HTTP) sin saber de HTTP.

## `drafts/`

- **`category_keywords.py`** — Palabras/frases gatillo por categoría por defecto (ver la migración 202608280003_seed_default_categories.py, que crea estas mismas categorías con user_id=None).
- **`draft_confirm.py`** — Confirmar un borrador: lo convierte en movimiento o en transferencia.
- **`draft_create.py`** — Crear borradores (de voz, de una foto o de capturas en lote) para que el usuario los revise.
- **`draft_review.py`** — Listar, editar y descartar borradores pendientes.
- **`entity_parser.py`** — Parser de monto/moneda/categoría en texto libre (español), compartido a futuro por voiceEntry y receiptScanner.
- **`full_balance_detector.py`** — Detecta si un dictado dice haber gastado TODO el saldo de una wallet real del usuario (pedido explicito: "he gastado todo lo que tenía en mi cuenta de Binance/ Facebank/cuenta de Venezuela").

## `ledger/`

- **`reference_backfill.py`** — Rellena o corrige el valor de referencia en USD de movimientos viejos (comando de manage.py).
- **`transaction_create.py`** — Registrar movimientos (uno o varios) y aplicar su efecto en el saldo de la billetera.
- **`transaction_delete.py`** — Borrar un movimiento (o una transferencia completa) revirtiendo su efecto en el saldo.
- **`transaction_read.py`** — Consultas de movimientos (sin efectos).
- **`transaction_update.py`** — Editar un movimiento: revierte el efecto viejo en el saldo y aplica el nuevo.
