# services/ — debts

La lógica de negocio. `__init__.py` es la **fachada**: los controllers, los comandos y la API pública del módulo solo hablan con ella, así un archivo puede partirse o moverse sin tocar a quien la usa.

Los services lanzan los errores de `../errors.py` (cada uno con su código HTTP) sin saber de HTTP.

- **`debt_payment_service.py`** — Registrar y borrar abonos a una deuda (opcionalmente moviendo una billetera).
- **`debt_service.py`** — Crear, listar y borrar deudas, y la respuesta con lo pagado y lo que falta.
- **`installment_service.py`** — Marcar cuotas como pagadas o pendientes.
- **`payment_voice_parser.py`** — Entender un abono dicho por voz para precargar el formulario.
