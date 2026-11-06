# tests/

Pruebas automáticas con pytest. Hay tres tipos, y cada una vive donde corresponde:

| Dónde | Qué prueban |
|---|---|
| `app/modules/<modulo>/tests/` | las reglas de negocio, llamando directo a los services (la mayoría) |
| `tests/e2e/<modulo>/` | cada endpoint por HTTP: códigos de respuesta y forma de lo que devuelve |
| `tests/architecture/` | que la estructura no se rompa (ver abajo) |

## Cómo correrlas

```bash
cd backend
pytest                              # toda la suite
pytest app/modules/wallets          # las unitarias de un módulo
pytest tests/e2e/wallets            # los endpoints de un módulo
pytest tests/architecture           # solo las reglas
```

## `tests/architecture/`

- `test_api_contract.py` — compara el contrato completo de la API (URLs, métodos,
  parámetros, cuerpos, respuestas y si piden sesión) con `api_contract_snapshot.json`.
  Renombrar una clase no lo cambia; cambiar una ruta, un campo o un código sí. Si el
  cambio es a propósito: `python -m tests.architecture.api_contract`.
- `test_rules.py` — de otro módulo solo se importa su `__init__.py`; los controllers
  solo hablan con la fachada; la carpeta del controller coincide con su grupo de acceso;
  toda ruta declara un `Resource`; `Dto` y `Resource` en su carpeta; variables de entorno
  solo en `app/config/`; paquetes de terceros solo en `app/support/`; máximo 600 líneas
  por archivo; README en cada carpeta.

## Cómo se arma la base de datos de prueba

Cada prueba corre contra una base de datos en memoria, vacía y recién creada — no toca la base de datos real de desarrollo. Esa base se arma directamente a partir de los modelos actuales, sin correr las migraciones de `alembic/`. Esto significa que si se cambia un modelo y no se escribe su migración, las pruebas no lo van a notar — pero la base de datos real sí quedaría desincronizada.

## Aislamiento de `.env` local

`conftest.py` (en la raíz de `backend/`) fija `DATABASE_URL`, `JWT_SECRET`, `MASTER_ENCRYPTION_KEY` y `FAKE_DATA_MODE` como variables de entorno de proceso antes de que se importe cualquier módulo de `app/` — le ganan a lo que haya en el `.env` real de quien corre las pruebas (Settings usa `env_file=".env"`, pero una env var de proceso tiene prioridad sobre ese archivo). Antes de esto, tener `FAKE_DATA_MODE=true` en el `.env` local (común mientras se prueba la app a mano) se colaba en las pruebas automáticas y hacía fallar 4 pruebas de login/auth en silencio. Ahora las pruebas corren siempre con el mismo estado, sin importar la configuración local de quien las ejecuta.
