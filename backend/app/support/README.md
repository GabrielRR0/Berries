# support/

Envoltorios de paquetes de terceros: **nadie importa el paquete directo** (lo comprueba
`tests/architecture/test_rules.py`). Si mañana cambia un paquete o su versión mayor, se
toca un solo lugar. Cada uno se usa con su prefijo, así se ve de dónde viene:
`password_support.hash_password(...)`, `http_support.get(...)`.

| Carpeta | Envuelve | Para |
|---|---|---|
| `password_support/` | `bcrypt` | hash y verificación de contraseñas |
| `jwt_support/` | `PyJWT` | firmar y leer tokens |
| `crypto_support/` | `cryptography` (Fernet) | cifrar textos |
| `http_support/` | `httpx` | llamadas a servicios externos |
| `rate_limit_support/` | `slowapi` | límite de pedidos |
| `google_identity_support/` | API de Google (vía `http_support`) | "Iniciar sesión con Google" |
| `turnstile_support/` | API de Cloudflare (vía `http_support`) | verificación anti-bots |

No se envuelven los paquetes acoplados al framework (`fastapi`, `pydantic`, `sqlalchemy`).

Para agregar uno: crear `support/<nombre>_support/` con `__init__.py` (lo que se
exporta), el archivo que usa el paquete y su `README.md`, y sumarlo a `THIRD_PARTY` en
`tests/architecture/test_rules.py`.
