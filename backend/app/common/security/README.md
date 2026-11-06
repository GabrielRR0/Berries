# common/security/

- `groups.py` — **grupos de acceso con nombre**: `public_group()`, `auth_group()` y
  `cron_group()`. Cada controller crea su router con uno, una sola vez, y vive en la
  carpeta que le corresponde (`public/`, `private/user/`, `system/`). Para cambiar lo que
  exige un grupo se edita solo este archivo.
- `current_user.py` — `get_current_user` (quién es el usuario a partir del token),
  `CurrentUser` (el tipo para recibirlo en un controller) y `verify_cron_secret`.
- `tokens.py` — crear y leer el token de sesión (JWT, vía `support/jwt_support`).
- `rate_limits.py` — `limiter`: 60 pedidos por minuto por IP en **todos** los endpoints;
  `/register` y `/login` tienen uno más estricto (`AUTH_ENDPOINT_LIMIT`, 10/min) por ser
  el blanco más valioso para fuerza bruta.
- `middleware.py` — rechazar cuerpos de más de 15 MB, verificar el origen del pedido y
  agregar headers de seguridad. El orden en que se activan está en `bootstrap/`.
