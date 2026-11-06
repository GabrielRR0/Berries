# Módulo `auth`

Cuentas: registro, login (contraseña y Google), perfil y borrado de cuenta.

## Rutas

| Método | Ruta | Acceso |
|---|---|---|
| POST | `/api/auth/register` | sin sesión |
| POST | `/api/auth/login` | sin sesión |
| POST | `/api/auth/google` | sin sesión |
| POST | `/api/auth/google/check` | sin sesión |
| GET | `/api/auth/me` | con sesión |
| DELETE | `/api/auth/me` | con sesión |

## API pública (`__init__.py`)

Lo único que otros módulos pueden importar: `User`, `auth_routers`, `register_user`.

## Carpetas

- `contracts/` — lo que entra (`dto/`) y lo que sale (`resources/`)
- `controllers/` — las rutas, por quién puede usarlas
- `models/` — las tablas (SQLAlchemy)
- `services/` — la lógica, con la fachada en `__init__.py`
- `tests/` — pruebas unitarias del módulo
- `errors.py` — los errores del módulo, cada uno con su código HTTP
