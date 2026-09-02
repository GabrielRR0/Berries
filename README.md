# Berries — finanzas personales (PWA)

## Problema que resuelve

Llevar el control de gastos/ingresos multi-moneda (VEF, USD, EUR, USDT, COP, ARS) entre varias cuentas/billeteras, con deudas y pagos a cuotas, sin depender de una hoja de cálculo. Pensado mobile-first para funcionar como PWA instalable en iOS/Android.

## Stack

- **Frontend:** Vue 3 (Composition API), Vue Router, Pinia, Vite.
- **Backend:** Python 3.12, FastAPI, SQLAlchemy + Alembic, Postgres (Supabase, vía connection pooler).
- **Auth:** JWT propio emitido por el backend (bcrypt para passwords) — Supabase se usa únicamente como base de datos, nunca expuesto al frontend.

## Cómo correr

**Todo con un solo comando** (recomendado para desarrollo local):
```
python run.py
```
Valida y prepara todo antes de arrancar (crea el venv del backend si falta, instala dependencias de backend/frontend si faltan, chequea que `backend/.env` tenga `DATABASE_URL`, `JWT_SECRET` y `MASTER_ENCRYPTION_KEY` completos, corre las migraciones) y después levanta backend (`:8002`) y frontend (`:5173`) juntos. Si falta algo (por ejemplo `backend/.env` recién creado desde `.env.example`), lo avisa y no arranca nada hasta que se complete.

**Backend y frontend por separado** (para correr cada uno solo, o entender qué hace `run.py` por dentro):

Backend:
```
cd backend
python -m venv .venv
./.venv/Scripts/activate   # o source .venv/bin/activate en Unix
pip install -r requirements.txt
cp .env.example .env       # completar DATABASE_URL, JWT_SECRET y MASTER_ENCRYPTION_KEY como mínimo
alembic upgrade head
uvicorn app.main:app --reload --port 8002
```

Frontend:
```
cd frontend
npm install
cp .env.example .env
npm run dev
```

## Cómo testear

```
cd backend && pytest
cd frontend && npx vitest run
```

## Decisiones de arquitectura

Ver `docs/` (en progreso) y el historial de decisiones documentado en cada dominio (`backend/app/services/<dominio>/`). Resumen de las divergencias deliberadas respecto a los proyectos hermanos del portafolio (`s-rank`, `tayuya-check`):

1. **SQLAlchemy + Alembic** (los hermanos van directo con `supabase-py` sin ORM) — un libro mayor financiero con transferencias, cuotas y deudas se beneficia de modelado relacional real y migraciones versionadas.
2. **El frontend nunca habla directo con Supabase** — a diferencia de `s-rank` (que sí lo hace para Realtime), en Berries toda la comunicación pasa por el backend.
3. **Vue Router + Pinia** (los hermanos los evitan) — Berries es una app multi-pantalla real con navegación por tabs y bastante estado compartido.
4. **Vercel Cron Jobs** — única excepción documentada a la regla "cero workers persistentes" del portafolio. Usada hoy para el refresco diario de tasas de cambio (`GET /api/cron/refresh-daily`, ver `app/routers/cron/cron_router.py` — evita que una moneda con inflación fuerte como VEF quede con una tasa vieja si nadie visita la app un día entero); planeada también para el escaneo diario de vencimientos/recordatorios (dominio `notifications`, construido de último a propósito). El `schedule` de `vercel.json` se declara siempre en UTC (Vercel no permite indicar zona horaria) — `"30 13 * * *"` es 9:30am hora de Venezuela (UTC-4), a propósito.

Identidad visual: paleta negro/rojo, dark-only (ver `docs/design-reference/README.md`).

## Estado

Proyecto en construcción activa. Beta cerrada, límite de usuarios configurable vía `MAX_BETA_USERS` (default 50).
