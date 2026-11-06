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

El backend está organizado **por módulo**, no por capa: todo lo de un dominio (rutas,
lo que entra y sale, lógica, tablas, errores y pruebas) vive en una carpeta. La guía
completa está en [../docs/BACKEND-MODULAR.md](../docs/BACKEND-MODULAR.md) y las reglas en
[../docs/CONVENCIONES.md](../docs/CONVENCIONES.md); cada carpeta tiene su `README.md`.

```
backend/
├── manage.py            comandos de administración (despacha a commands/ de cada módulo)
├── alembic/             migraciones de la base — ver alembic/README.md
├── conftest.py          base de prueba en memoria y fixtures (client, db)
├── app/
│   ├── main.py          app = create_app()
│   ├── bootstrap/       arma la app: middlewares, errores, rutas
│   ├── config/          ÚNICA capa que lee variables de entorno
│   ├── database/        conexión, Base, tipos de columna y registro de modelos
│   ├── common/          seguridad, errores de dominio, cifrado de columnas
│   ├── support/         envoltorios de paquetes de terceros (nadie importa el paquete directo)
│   ├── routes/          un archivo de rutas por módulo, todo bajo /api
│   └── modules/         un módulo por dominio:
│       ├── auth/ wallets/ transactions/ categories/ currency/ debts/ goals/
│       └── analytics/ voice_entry/ receipt_scanner/ health/ dev_tools/
└── tests/
    ├── e2e/             pruebas por HTTP, una carpeta por módulo
    └── architecture/    contrato de la API y reglas de arquitectura
```

Un módulo (referencia viva: `app/modules/debts/`):

```
debts/
  __init__.py            API pública: lo único que otros módulos importan
  controllers/private/user/   las rutas, en la carpeta de quién puede usarlas
  contracts/dto/         lo que ENTRA (CreateDebtDto...)
  contracts/resources/   lo que SALE (DebtResource...)
  services/__init__.py   fachada; un archivo por caso de uso
  models/  errors.py  tests/
```

## Variables de entorno críticas (sin default — la app no arranca si faltan)

- `DATABASE_URL`
- `JWT_SECRET`
- `MASTER_ENCRYPTION_KEY` — encripta los datos financieros del usuario a nivel de columna (ver `app/common/crypto/README.md`). **Si se pierde, los datos ya guardados quedan ilegibles para siempre** — hacer backup de esta clave por separado de la base de datos.

Ver `.env.example` para la lista completa, con comentarios de por qué cada una tiene o no tiene default.
