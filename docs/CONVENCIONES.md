# Convenciones del proyecto

Reglas de arquitectura. Las marcadas con 🔒 las comprueba una prueba (`pytest` en el
backend, `npm test` en el frontend): si se rompen, la suite falla.

## 1. Modularidad

- Cada dominio vive en **su carpeta de módulo**, con un archivo padre que es lo único
  que se importa desde fuera (`__init__.py` en el backend, `index.ts` en el frontend).
- 🔒 **De otro módulo solo se importa su archivo padre**, nunca un archivo interno.
- 🔒 **Máximo 600 líneas por archivo.** Si crece, se parte en archivos con nombre propio.

## 2. Backend (`backend/app/modules/<modulo>/`)

Guía completa y estructura: [BACKEND-MODULAR.md](BACKEND-MODULAR.md). Referencia viva:
`modules/debts/`.

**Reglas generales**
- Controller: **cero lógica**. Recibe, llama a la fachada `services` y devuelve su
  Resource. 🔒 Nunca importa un archivo de `services/` directo.
- Validación: **solo** en `contracts/dto/`. Lógica: **solo** en services.
- Los DTO **nunca** aceptan `user_id` ni campos internos: el usuario sale del token
  (`user: CurrentUser`).
- `contracts/` no importa de controllers ni de services; solo al revés.
- Un comando de `manage.py` = una llamada a la fachada (`<modulo>/commands/`).

**Controllers**
- Un archivo = **un acceso + un recurso**. 🔒 El router se crea con el grupo de su
  carpeta: `public/` → `public_group()`, `private/user/` → `auth_group()`,
  `system/` → `cron_group()`. Los grupos están en `common/security/groups.py`.
- 🔒 Toda ruta que responde algo declara `response_model=<X>Resource` y anota el mismo
  tipo de retorno.
- Sin `try/except`: los services lanzan errores de `errors.py` (que heredan de
  `DomainError` con su `status_code`) y el manejador global responde `{"detail": ...}`.
- Rutas fijas (`/summary`, `/drafts`) antes que `/{id}`: en `controllers/__init__.py`
  el router que tiene `/{id}` va **último**.
- Para recibir sesión y usuario: `db: DbSession, user: CurrentUser`.

**Contracts**
- `dto/`: un archivo por caso (`create_debt_dto.py` → `CreateDebtDto`).
- `resources/`: un archivo por respuesta (`debt_resource.py` → `DebtResource`). Si una
  respuesta incluye otra, la importa (`DebtResource.installments: list[InstallmentResource]`).
- `enums.py`: los `Literal` que comparten entrada y salida.
- 🔒 Los nombres terminan en `Dto` o `Resource` según su carpeta.

**Services**
- `services/__init__.py` es la **fachada**: lo que usan los controllers, los comandos y
  la API pública. Si un archivo se parte, la fachada mantiene los mismos nombres.
- Una carpeta por **tema** (un sustantivo: `ledger/`, `drafts/`, `history/`) y un
  archivo por **caso de uso**, cuando hay más de 4 archivos. No se separa por verbo
  (crear/editar/borrar comparten permisos y validaciones).
- Un archivo de más de ~150 líneas se divide.
- Lo que comparten varios services, si es puro, va en `utils/`.
- Lo que necesita la ruta (por ejemplo armar una lista de Resources) es un caso de uso
  del service, no código del controller.

**Nombres: el sufijo dice el papel**

| Sufijo | Papel | Ejemplo |
|---|---|---|
| `Dto` | lo que entra por HTTP | `CreateDebtDto` |
| `Resource` | lo que sale por HTTP | `DebtResource` |
| `Error` | error de dominio con su código | `DebtNotFoundError` (404) |
| `_service.py` / `<caso>.py` | lógica | `transaction_create.py` |
| `_controller.py` | rutas | `debts_controller.py` |

Código y nombres de archivo en inglés técnico; textos para el usuario en español.

**Imports**
- Absolutos desde `app.` (`from app.modules.wallets import Wallet`).
- 🔒 De otro módulo, solo `from app.modules.<m> import ...`.

## 3. Variables de entorno

- 🔒 **Solo `app/config/` las lee** (backend). Los services piden `settings.<campo>`.
- Cada variable nueva se documenta en `.env.example`.

## 4. Paquetes de terceros

- 🔒 En el backend, `bcrypt`, `PyJWT`, `cryptography`, `httpx` y `slowapi` solo se importan
  desde su envoltorio en `app/support/<nombre>_support/`. Se usan con el prefijo:
  `http_support.get(...)`, `password_support.hash_password(...)`.
- No se envuelven los acoplados al framework (`fastapi`, `pydantic`, `sqlalchemy`).
- Las pruebas pueden importarlos para simularlos.

## 5. Pruebas

- Unitarias de un módulo: `app/modules/<modulo>/tests/` (llaman directo a los services).
- Por HTTP: `tests/e2e/<modulo>/`.
- Arquitectura: `tests/architecture/` (contrato de la API y reglas de este documento).
- 🔒 El contrato HTTP completo se compara con una foto: si cambias una ruta a propósito,
  `python -m tests.architecture.api_contract`.

## 6. Migraciones

- Cada cambio de esquema es una migración de Alembic (`python manage.py make:migration "..."`),
  revisada a mano antes de `python manage.py migrate`.
- Un modelo nuevo se registra en `app/database/registry.py`.
- No se edita una migración ya aplicada: se crea otra que la corrija.

## 7. Documentación

- 🔒 README en cada carpeta de módulo, de capa (`controllers/`, `contracts/`, `services/`)
  y de infraestructura.
- Si cambias algo documentado, actualiza el documento en el mismo cambio.
