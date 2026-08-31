# alembic/

Acá viven las migraciones: los cambios de esquema de la base de datos, guardados como archivos versionados. Es la única forma en la que la base de datos cambia — nunca se edita a mano ni se generan tablas automáticamente contra la base real.

## Cómo correrlas

Usar los comandos de `manage.py` (en la raíz de `backend/`):

```bash
cd backend
python manage.py migrate              # aplica todas las migraciones pendientes
python manage.py migrate:rollback     # revierte la última migración aplicada
python manage.py make:migration "mensaje"   # genera una migración nueva
```

`make:migration` compara los modelos de `app/models/` contra la base actual y genera el archivo solo. Conviene siempre revisarlo a mano antes de correr `migrate` — a veces no detecta bien un cambio de tipo de columna.

## Un archivo por tabla

Cada migración hace **una sola cosa**: crea una tabla, o hace un cambio puntual como agregar una columna. No se juntan varias tablas distintas en un mismo archivo. Antes había una sola migración gigante que creaba 7 tablas de una — se separó en 7 archivos, uno por tabla, para poder encontrar rápido dónde se creó cada una y revertir un cambio sin arrastrar los demás.

El nombre de archivo sigue el patrón `YYYYMMDDNNNN_descripcion.py` (por ejemplo `202608190002_create_wallets_table.py`). Ese número solo ayuda a ordenar los archivos al mirarlos en una carpeta — el orden real en que se aplican lo define la cadena de revisiones dentro de cada archivo, no el nombre.

## SQLite en desarrollo, Postgres en producción

En desarrollo se usa SQLite (`berry_dev.db`), y en producción Postgres. SQLite no permite modificar una columna existente directamente (cambiar su tipo, por ejemplo) — hay que envolver ese cambio en `op.batch_alter_table(...)`. Un ejemplo real es `202608220002_encrypt_financial_columns.py`, que cambia varias columnas para que puedan guardar datos encriptados (ver `../app/core/README.md`). Ese mismo código funciona sin problema contra Postgres también, así que no hace falta escribir la migración dos veces.

## Ojo: una migración no reescribe los datos que ya existen

Una migración cambia la estructura de la tabla, pero no toca las filas que ya estaban guardadas. Si un cambio hace que esos datos viejos dejen de tener sentido con el tipo nuevo (por ejemplo, encriptar una columna que antes tenía texto plano — al leerla después, intenta desencriptar algo que nunca se encriptó, y falla), la migración por sí sola no arregla eso.

En este proyecto, como todavía no hay usuarios reales, la solución fue simple: borrar la base de desarrollo y volver a sembrarla con datos de prueba (`python manage.py seed:demo --reset`) después de aplicar el cambio. Con datos reales ya no alcanzaría con esto — haría falta un paso extra que lea los datos viejos y los reescriba con el formato nuevo.

## Ver el estado actual

```bash
python -m alembic current   # qué migración está aplicada ahora
python -m alembic history   # todas las migraciones, en orden
```
