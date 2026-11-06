# services/ — receipt_scanner

La lógica de negocio. `__init__.py` es la **fachada**: los controllers, los comandos y la API pública del módulo solo hablan con ella, así un archivo puede partirse o moverse sin tocar a quien la usa.

Los services lanzan los errores de `../errors.py` (cada uno con su código HTTP) sin saber de HTTP.

- **`receipt_scanner_service.py`** — Leer la foto de un recibo y crear un borrador de movimiento.

## `ocr/`

- **`vision_client.py`** — Cliente del proveedor de OCR (apagado hasta configurar su clave).
