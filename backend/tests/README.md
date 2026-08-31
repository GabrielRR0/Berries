# tests/

Pruebas automáticas con pytest. La estructura de carpetas copia la de `app/`: cada archivo tiene su prueba en la misma ubicación relativa dentro de `tests/`.

## Cómo correrlas

```bash
cd backend
pytest                            # toda la suite
pytest tests/services/wallets/    # solo un dominio
```

## Qué prueba cada carpeta

- **`tests/services/<dominio>/`** — la mayoría de las pruebas. Llaman directo a las funciones de `app/services/`, sin pasar por la API. Acá se prueban las reglas de negocio de verdad.
- **`tests/routers/<dominio>/`** — más pocas, y a propósito. Prueban que cada endpoint responda con el código correcto, no repiten las pruebas de negocio.
- **`tests/core/`** — pruebas de cosas transversales que no pertenecen a un dominio.

## Cómo se arma la base de datos de prueba

Cada prueba corre contra una base de datos en memoria, vacía y recién creada — no toca la base de datos real de desarrollo. Esa base se arma directamente a partir de los modelos actuales, sin correr las migraciones de `alembic/`. Esto significa que si se cambia un modelo y no se escribe su migración, las pruebas no lo van a notar — pero la base de datos real sí quedaría desincronizada.

## Aislamiento de `.env` local

`tests/conftest.py` fija `DATABASE_URL`, `JWT_SECRET`, `MASTER_ENCRYPTION_KEY` y `FAKE_DATA_MODE` como variables de entorno de proceso antes de que se importe cualquier módulo de `app/` — le ganan a lo que haya en el `.env` real de quien corre las pruebas (Settings usa `env_file=".env"`, pero una env var de proceso tiene prioridad sobre ese archivo). Antes de esto, tener `FAKE_DATA_MODE=true` en el `.env` local (común mientras se prueba la app a mano) se colaba en las pruebas automáticas y hacía fallar 4 pruebas de login/auth en silencio. Ahora las pruebas corren siempre con el mismo estado, sin importar la configuración local de quien las ejecuta.
