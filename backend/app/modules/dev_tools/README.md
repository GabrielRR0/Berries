# Módulo `dev_tools`

Herramientas de desarrollo: usuario demo con datos sembrados (FAKE_DATA_MODE).

## Solo para desarrollo

No es parte de la app real: crea el usuario demo con datos sembrados que usa
`FAKE_DATA_MODE=true` (el login entra siempre a ese usuario) y el comando
`python manage.py seed:demo [--reset]`. En producción `FAKE_DATA_MODE` se ignora.

## API pública (`__init__.py`)

Lo único que otros módulos pueden importar: `DEMO_EMAIL`, `get_or_create_demo_user`, `seed_demo_command`.

## Carpetas

- `commands/` — comandos de `manage.py`; cada uno solo llama a la fachada
- `services/` — la lógica, con la fachada en `__init__.py`
- `tests/` — pruebas unitarias del módulo
