# Módulo `voice_entry`

Registro por voz: corrige el texto dictado y lo convierte en borrador.

## Rutas

| Método | Ruta | Acceso |
|---|---|---|
| POST | `/api/voice-entry` | con sesión |

## API pública (`__init__.py`)

Lo único que otros módulos pueden importar: `correct_transcript`, `voice_entry_routers`.

## Carpetas

- `contracts/` — lo que entra (`dto/`) y lo que sale (`resources/`)
- `controllers/` — las rutas, por quién puede usarlas
- `services/` — la lógica, con la fachada en `__init__.py`
- `tests/` — pruebas unitarias del módulo
