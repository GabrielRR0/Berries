# config/

**Única capa que lee variables de entorno** (lo comprueba `tests/architecture/test_rules.py`).
`settings.py` las valida con pydantic-settings al arrancar; si falta una obligatoria
(`DATABASE_URL`, `JWT_SECRET`, `MASTER_ENCRYPTION_KEY`) la app no arranca.

El resto del código pide `settings.<campo>` (`from app.config import settings`) y nunca
el nombre de la variable. Renombrar una variable es editar solo `settings.py`; cada
variable nueva se documenta en `.env.example`.
