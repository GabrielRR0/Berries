# Módulo `categories`

Categorías de movimientos: las por defecto, las propias del usuario y las ocultas.

## Rutas

| Método | Ruta | Acceso |
|---|---|---|
| GET | `/api/categories` | con sesión |
| POST | `/api/categories` | con sesión |
| DELETE | `/api/categories/{category_id}` | con sesión |
| POST | `/api/categories/{category_id}/hide` | con sesión |
| DELETE | `/api/categories/{category_id}/hide` | con sesión |

## API pública (`__init__.py`)

Lo único que otros módulos pueden importar: `Category`, `DEFAULT_CATEGORIES`, `HiddenCategory`, `categories_routers`, `create_category`.

## Carpetas

- `contracts/` — lo que entra (`dto/`) y lo que sale (`resources/`)
- `controllers/` — las rutas, por quién puede usarlas
- `models/` — las tablas (SQLAlchemy)
- `services/` — la lógica, con la fachada en `__init__.py`
- `tests/` — pruebas unitarias del módulo
- `utils/` — funciones puras que comparten varios services
- `errors.py` — los errores del módulo, cada uno con su código HTTP
