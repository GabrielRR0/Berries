# routes/

El árbol de rutas: `api_routes.py` crea el grupo `/api` y le registra un archivo por
módulo (`<modulo>_routes.py`). Cada archivo toma la lista ordenada de routers que exporta
el módulo (`<modulo>_routers`) y le pone su prefijo.

Para agregar un módulo: crear `routes/<modulo>_routes.py` con su `register(api)` e
incluirlo en `api_routes.py`.

`tests/architecture/test_api_contract.py` compara el contrato completo (URLs, métodos,
parámetros, cuerpos, respuestas y si piden sesión) con una foto guardada: un cambio de
rutas sin querer hace fallar las pruebas. Si el cambio es a propósito:
`python -m tests.architecture.api_contract`.
