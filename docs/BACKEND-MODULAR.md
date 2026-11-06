# Sistema modular del backend (FastAPI)

Es el mismo sistema del backend de proyectoAlquiler (NestJS), traducido a Python. Todo
lo que se describe acá existe y está comprobado en `backend/app`: el módulo
`app/modules/debts` es la **referencia viva** (cada carpeta tiene su README). Las reglas
detalladas están en [CONVENCIONES.md](CONVENCIONES.md).

## La idea en una frase

> Cada cosa vive en un solo lugar y su carpeta dice lo que es: **quién puede usar la ruta**
> (controllers), **qué entra y qué sale** (contracts), **qué hace** (services). Lo que se
> puede comprobar con código, se comprueba con código.

## De NestJS a FastAPI

| proyectoAlquiler (Nest) | Berry (FastAPI) |
|---|---|
| `<modulo>.module.ts` + `index.ts` | `modules/<modulo>/__init__.py`: la API pública, con `public_api()` |
| `@PublicGroup()`, `@AuthGroup()` en la clase | `router = public_group()` / `auth_group()` / `cron_group()`, una vez por archivo |
| `controllers: [...]` del módulo (el orden importa) | `controllers/__init__.py` exporta `<modulo>_routers`, una lista ordenada |
| `routes/<modulo>.routes.ts` | `routes/<modulo>_routes.py` con `register(api)`: pone el prefijo |
| DTO con class-validator | `contracts/dto/<caso>_dto.py`: modelo Pydantic, sufijo `Dto` |
| Resource (interface) + validador de contrato en e2e | `contracts/resources/<respuesta>_resource.py`, sufijo `Resource`, usado como `response_model` (FastAPI filtra lo que no declara) |
| fachada `<modulo>.service.ts` | `services/__init__.py` |
| `common/errors` + filtro global | `common/errors.DomainError` con `status_code` + manejador global |
| Prisma (esquema central) | `modules/<modulo>/models/` + `database/registry.py` |
| `support/` y regla de ESLint | `support/<nombre>_support/` y `tests/architecture/test_rules.py` |
| `config/` con Zod | `config/settings.py` con pydantic-settings |
| `bootstrap/configure-app.ts` | `bootstrap/configure_app.py` → `create_app()` |
| alias `@/` | imports absolutos `app.…` (lo normal en Python) |
| ESLint (`module-boundaries`, 600 líneas...) | `tests/architecture/test_rules.py` (pytest) |

## Estructura

```
backend/app/
  main.py · bootstrap/     create_app(): middlewares, errores y rutas
  config/                  única capa que lee variables de entorno
  database/                engine, Base, DbSession, column_types, registry
  common/                  security, errors, crypto, modules (public_api)
  support/                 envoltorios de terceros
  routes/                  api_routes.py + un <modulo>_routes.py por módulo
  modules/<modulo>/        la lógica de negocio, un módulo por carpeta
backend/tests/
  e2e/<modulo>/            pruebas por HTTP
  architecture/            contrato de la API y reglas
```

## Estructura de un módulo

```
<modulo>/
  __init__.py               API pública (lo único que otros módulos importan)
  README.md
  controllers/
    __init__.py             <modulo>_routers = [...]  (el que tiene /{id}, último)
    anonymous/              sin sesión                      public_group()
    private/user/           cualquier usuario con sesión    auth_group()
    system/                 Vercel Cron (CRON_SECRET)       cron_group()
  contracts/
    dto/                    lo que ENTRA, un archivo por caso
    resources/              lo que SALE, un archivo por respuesta
    enums.py                Literal que comparten los dos
  services/
    __init__.py             fachada
    <tema>/<caso>.py        un archivo por caso de uso (temas solo si hay más de 4)
  models/                   tablas SQLAlchemy
  errors.py                 errores con su código HTTP
  utils/                    funciones puras compartidas por varios services
  commands/                 comandos de manage.py: cada uno llama a la fachada
  tests/                    pruebas unitarias del módulo
```

Las carpetas aparecen **solo si hacen falta**.

## Un ejemplo completo

```python
# contracts/dto/create_widget_dto.py                       (entra)
class CreateWidgetDto(BaseModel):
    name: str = Field(min_length=1, max_length=120)

# contracts/resources/widget_resource.py                    (sale)
class WidgetResource(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    name: str

# errors.py
class WidgetNotFoundError(DomainError):
    status_code = 404

# controllers/private/user/widgets_controller.py
router = auth_group()

@router.post("", response_model=WidgetResource, status_code=201)
async def create(payload: CreateWidgetDto, db: DbSession, user: CurrentUser) -> WidgetResource:
    return WidgetResource.model_validate(services.create_widget(db, user.id, payload.name))

# controllers/__init__.py
widgets_routers = [widgets_controller.router]

# __init__.py (API pública)
if TYPE_CHECKING:
    from app.modules.widgets.controllers import widgets_routers
    from app.modules.widgets.models import Widget

__getattr__, __dir__, __all__ = public_api(__name__, __file__)

# app/routes/widgets_routes.py
def register(api: APIRouter) -> None:
    for router in widgets_routers:
        api.include_router(router, prefix="/widgets", tags=["widgets"])
```

## Por qué la API pública es perezosa

Hay dominios que se usan entre sí: una transferencia (wallets) crea movimientos
(transactions), y un borrador (transactions) puede confirmarse como transferencia
(wallets). En Python, si cada `__init__.py` importara todo al cargarse, ese ciclo
rompería el arranque. `public_api()` lee los imports que el `__init__.py` declara dentro
de `if TYPE_CHECKING:` (el editor los ve normales) y carga cada nombre recién cuando
alguien lo pide.

## Qué hace cumplir el código

| Regla | Prueba |
|---|---|
| El contrato HTTP no cambia sin querer | `tests/architecture/test_api_contract.py` |
| De otro módulo solo su `__init__.py` | `test_other_modules_are_only_imported_through_their_public_api` |
| Controllers solo hablan con la fachada | `test_controllers_only_talk_to_the_module_facade` |
| Carpeta del controller = grupo de acceso | `test_controller_folder_matches_its_access_group` |
| Toda ruta declara su `Resource` | `test_every_route_declares_a_resource` |
| `Dto` en `dto/`, `Resource` en `resources/` | `test_dto_and_resource_names_say_their_role` |
| Variables de entorno solo en `config/` | `test_environment_is_only_read_in_config` |
| Paquetes de terceros solo en `support/` | `test_third_party_packages_only_inside_support` |
| Máximo 600 líneas por archivo | `test_no_file_is_longer_than_600_lines` |
| README en cada carpeta | `test_every_folder_has_a_readme` |

## Crear un módulo nuevo (lista)

1. Lista las rutas y **quién puede usar cada una**: eso decide las carpetas de `controllers/`.
2. `contracts/dto/` con un DTO por caso y `contracts/resources/` con un Resource por respuesta.
3. `errors.py` con el código HTTP de cada error.
4. `services/` con la fachada en `__init__.py` y, si pasan de 4 archivos, carpetas por tema.
5. Controllers con el grupo en el router, sin `try/except` y llamando solo a `services`.
6. `controllers/__init__.py`, `__init__.py` del módulo, `routes/<modulo>_routes.py` (e
   incluirlo en `api_routes.py`), y los modelos en `database/registry.py`.
7. README en cada carpeta nueva.
8. Verifica: `pytest` (incluye las reglas). Si cambiaste rutas a propósito, regenera la
   foto del contrato con `python -m tests.architecture.api_contract`.

## Límites conocidos

- `currency/services/history/vef_history.py` pasa de las ~150 líneas: la guardia del
  historial y el relleno comparten estado en memoria del proceso, por eso no se separan.
- La regla de "un caso de uso por archivo" se aplica donde los archivos eran grandes;
  los services chicos que ya agrupaban un tema (por ejemplo `debts/services/`) quedaron
  planos.
- Las pruebas pueden importar internos de un módulo (para simular una función con
  `monkeypatch`); la regla de fronteras se aplica al código de `app/`.
