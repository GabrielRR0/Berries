# Berries — backend

Esta es la API de Berries: recibe pedidos del frontend, guarda y lee de la base de datos, y aplica todas las reglas de negocio (saldos, transferencias, deudas, etc.). Está hecha con FastAPI y guarda los datos en Postgres en producción, o SQLite en desarrollo. Ver `../README.md` para el panorama completo del proyecto (frontend incluido).

## Cómo correr

Para levantar backend + frontend juntos con un solo comando (valida `.env`, instala dependencias y corre migraciones solo) ver `../README.md` → `python run.py` desde la raíz del proyecto.

Para correr solo el backend:

```bash
python -m venv .venv
./.venv/Scripts/activate       # source .venv/bin/activate en Unix
pip install -r requirements.txt
cp .env.example .env           # completar DATABASE_URL, JWT_SECRET, MASTER_ENCRYPTION_KEY
python manage.py migrate       # aplica todas las migraciones — ver alembic/README.md
uvicorn app.main:app --reload --port 8002
```

Se usa el puerto **8002** para que no choque con los otros proyectos del portafolio, que ya usan el 8000 y el 8001 — así se pueden tener varios corriendo al mismo tiempo.

## Cómo testear

```bash
pytest      # ver tests/README.md
```

## `manage.py` — CLI de administración

```bash
python manage.py migrate                   # alembic upgrade head
python manage.py migrate:rollback          # alembic downgrade -1
python manage.py make:migration "mensaje"  # alembic revision --autogenerate
python manage.py seed:demo [--reset]       # crea/reseedea el usuario demo (FAKE_DATA_MODE)
```

100% Alembic/SQLAlchemy por debajo — no es un framework de migraciones propio, son nombres de comando cortos y fáciles de recordar sobre las mismas herramientas.

## Modo demo (`FAKE_DATA_MODE`)

Con `FAKE_DATA_MODE=true` en `.env`, el login acepta cualquier email/contraseña y siempre entra al mismo usuario de prueba, que ya tiene billeteras, movimientos y deudas cargadas — sirve para probar la app sin tener que registrar una cuenta real. Esto se ignora por completo en producción, aunque alguien deje la variable prendida por error.

**Ojo**: si esta variable queda prendida en el `.env` local, también afecta a las pruebas automáticas y rompe 4 de ellas relacionadas al login. Está explicado en `tests/README.md`.

## Estructura

```
backend/
├── manage.py               # comandos de administración (ver arriba)
├── alembic/                 # cambios de la base de datos — ver alembic/README.md
├── app/
│   ├── main.py               # arranca la aplicación y conecta todo
│   ├── config.py              # configuración, lee el .env
│   ├── core/                   # cosas que usa toda la app — ver app/core/README.md
│   ├── models/                  # cómo se ve cada tabla — ver app/models/README.md
│   ├── schemas/                  # forma de lo que entra/sale por la API — ver app/schemas/README.md
│   ├── routers/                   # los endpoints — ver app/routers/README.md
│   ├── services/                   # las reglas de negocio — ver app/services/README.md
│   └── shared/                      # reservado para el futuro, hoy vacío
└── tests/                    # pruebas automáticas — ver tests/README.md
```

Cada dominio (auth, wallets, transactions, currency, debts, analytics, voiceEntry, receiptScanner) tiene su propia carpeta dentro de `models/`, `schemas/`, `routers/` y `services/` — para entender un dominio completo hay que mirar esas cuatro carpetas juntas.

## Variables de entorno críticas (sin default — la app no arranca si faltan)

- `DATABASE_URL`
- `JWT_SECRET`
- `MASTER_ENCRYPTION_KEY` — encripta los datos financieros del usuario a nivel de columna (ver `app/core/README.md`). **Si se pierde, los datos ya guardados quedan ilegibles para siempre** — hacer backup de esta clave por separado de la base de datos.

Ver `.env.example` para la lista completa, con comentarios de por qué cada una tiene o no tiene default.
