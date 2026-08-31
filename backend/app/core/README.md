# app/core/

Cosas que usa toda la aplicación, sin importar el dominio (auth, wallets, transacciones, etc.). Si un archivo necesita saber qué es una "transferencia" o un "borrador", no va acá — va en `app/services/<dominio>/`.

## Qué hay en cada archivo

- **`database.py`** — la conexión a la base de datos y la clase base de la que heredan todos los modelos.

- **`deps.py`** — piezas que los routers piden como dependencia: una sesión de base de datos por request (`get_db`), y "quién es el usuario logueado" a partir del token (`get_current_user`). Cualquier router que necesite saber quién está pidiendo algo usa esto, en vez de leer el token a mano.

- **`security.py`** — todo lo relacionado a contraseñas y tokens: encriptar/verificar contraseñas, y generar/leer los JWT de sesión.

- **`encryption.py`** — encripta y desencripta los datos financieros del usuario (balances, montos, categorías, etc.) antes de guardarlos y al leerlos. Funciona de forma transparente: el resto del código lee un monto normal, sin enterarse de que por debajo está encriptado. Necesita una clave (`MASTER_ENCRYPTION_KEY`) configurada — si falta, la aplicación no arranca. Un efecto importante de esto: como cada valor se encripta distinto cada vez, ya no se puede sumar ni filtrar por esos campos directamente en la base de datos (ver `app/services/analytics/analytics_service.py`, que por eso hace esas cuentas en Python). Qué campos están encriptados y cuáles no está explicado en cada modelo de `app/models/`.

- **`rate_limit.py`** — limita cuántas veces puede pedir algo la misma IP en un tiempo dado. `default_limits` (60/minute) protege TODOS los endpoints automáticamente sin tener que decorar cada uno; `/register` y `/login` tienen su propio límite más estricto (10/minute, ver `auth_router.py`) porque son el blanco más valioso para fuerza bruta.

- **`middleware.py`** — capas que revisan cada request antes de que llegue a un router: rechazar archivos demasiado grandes, verificar que el origen de la petición sea válido, y agregar headers de seguridad estándar a la respuesta. El orden en que se activan (ver `app/main.py`) importa.

## `app/shared/`

Funciones que se comparten entre varios dominios (no pertenecen a uno solo, a diferencia de `app/services/<dominio>/`):

- **`turnstile.py`** — verificación de Cloudflare Turnstile (anti-bot) para `/register` y `/login`, ver `app/shared/turnstile.py`. Apagada por default (`TURNSTILE_ENABLED=false`) hasta que exista un widget real creado en Cloudflare - mismo criterio que OCR/tasas de cambio en este proyecto.
