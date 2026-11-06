# common/

Infraestructura que usa toda la app y no sabe de ningún dominio. Si algo necesita saber
qué es una "transferencia" o un "borrador", va en `app/modules/<modulo>/`.

| Carpeta | Qué hay |
|---|---|
| `security/` | grupos de acceso, usuario actual, token de sesión, límites de pedidos y middlewares |
| `errors/` | `DomainError` y el manejador que lo convierte en respuesta HTTP |
| `crypto/` | tipos de columna cifrados para los datos financieros |
| `modules/` | `public_api()`, la herramienta del `__init__.py` de cada módulo |
