# database/

- `base.py` — `Base`, la clase de la que heredan todos los modelos.
- `session.py` — conexión (`engine`, con `NullPool` por ser serverless), `SessionLocal`,
  `get_db` (una sesión por request) y `DbSession`, el tipo para recibirla en un controller.
- `column_types.py` — alias de columnas que se repiten (`UuidPk`, `CreatedAt`, `UserFk`...).
- `registry.py` — importa todos los modelos para que `Base.metadata` quede completo. Lo
  usan la app, Alembic y las pruebas. **Un módulo con tablas nuevas se agrega acá.**

Los modelos viven en `app/modules/<modulo>/models/`. Las migraciones, en `backend/alembic/`.
