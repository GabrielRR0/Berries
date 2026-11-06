# Módulo `health`

Chequeo de salud de la API.

## Rutas

| Método | Ruta | Acceso |
|---|---|---|
| GET | `/api/health` | sin sesión |

## API pública (`__init__.py`)

Lo único que otros módulos pueden importar: `health_routers`.

## Carpetas

- `contracts/` — lo que entra (`dto/`) y lo que sale (`resources/`)
- `controllers/` — las rutas, por quién puede usarlas
