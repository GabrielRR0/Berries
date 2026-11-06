# services/ — auth

La lógica de negocio. `__init__.py` es la **fachada**: los controllers, los comandos y la API pública del módulo solo hablan con ella, así un archivo puede partirse o moverse sin tocar a quien la usa.

Los services lanzan los errores de `../errors.py` (cada uno con su código HTTP) sin saber de HTTP.

- **`account_deletion_service.py`** — Borrar la cuenta propia con todos sus datos.
- **`auth_service.py`** — Registro, login con contraseña y login con Google.
- **`human_check.py`** — Verificación anti-bots (Cloudflare Turnstile) de registro y login.
- **`session_service.py`** — La respuesta de sesión que devuelven registro y login: token + datos del usuario.
