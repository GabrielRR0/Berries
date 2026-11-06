# Módulo `receipt_scanner`

Lectura de recibos por foto (OCR) que termina en un borrador de movimiento.

## Rutas

| Método | Ruta | Acceso |
|---|---|---|
| POST | `/api/receipt-scanner` | con sesión |

## API pública (`__init__.py`)

Lo único que otros módulos pueden importar: `receipt_scanner_routers`.

## Carpetas

- `controllers/` — las rutas, por quién puede usarlas
- `services/` — la lógica, con la fachada en `__init__.py`
- `tests/` — pruebas unitarias del módulo
- `errors.py` — los errores del módulo, cada uno con su código HTTP
