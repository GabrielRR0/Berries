# services/ — dev_tools

La lógica de negocio. `__init__.py` es la **fachada**: los controllers, los comandos y la API pública del módulo solo hablan con ella, así un archivo puede partirse o moverse sin tocar a quien la usa.

Los services lanzan los errores de `../errors.py` (cada uno con su código HTTP) sin saber de HTTP.

- **`demo_reset_service.py`** — Borrar el usuario demo y todo lo que se le sembró (lo usa `manage.py seed:demo --reset`).
- **`demo_seed_service.py`** — Semilla de datos falsos para modo demo (ver app.config.Settings.fake_data_mode_active).
