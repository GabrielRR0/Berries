# controllers/ — categories

Las rutas del módulo, separadas por **quién puede usarlas**. Cada archivo crea su router con el grupo de acceso de su carpeta (lo comprueba `tests/architecture/test_rules.py`) y solo llama a la fachada `services`.

`__init__.py` lista los routers en el orden en que se registran: el que tiene una ruta `/{id}` va último para no tapar a las rutas fijas.

## `private/user/` — cualquier usuario con sesión (`auth_group()`)

- **`categories_controller.py`** — `GET /api/categories`, `POST /api/categories`, `DELETE /api/categories/{category_id}`, `POST /api/categories/{category_id}/hide`, `DELETE /api/categories/{category_id}/hide`
