"""Grupos de acceso con nombre: quién puede usar las rutas de un controller.

Cada controller crea su router con uno de estos, una sola vez, y vive en la carpeta
que le corresponde (lo comprueba tests/architecture/test_rules.py):

| Grupo            | Carpeta                     | Quién                          |
|------------------|-----------------------------|--------------------------------|
| `public_group()` | `controllers/anonymous/`    | cualquiera, sin sesión         |
| `auth_group()`   | `controllers/private/user/` | cualquier usuario con sesión   |
| `cron_group()`   | `controllers/system/`       | Vercel Cron, con `CRON_SECRET` |

Para cambiar lo que exige un grupo se edita solo este archivo.

La carpeta de las rutas sin sesión se llama `anonymous/` y no `public/` a propósito:
Vercel descarta del paquete del backend cualquier carpeta `public/` (la reserva para
archivos estáticos) y la app no arrancaría. Lo comprueba tests/architecture/test_vercel_bundle.py.
"""

from fastapi import APIRouter, Depends

from app.common.security.current_user import get_current_user, verify_cron_secret

PUBLIC = "public"
AUTH = "auth"
CRON = "cron"


def _router(group: str, dependencies: list) -> APIRouter:
    router = APIRouter(dependencies=dependencies)
    router.access_group = group  # lo lee la prueba de arquitectura
    return router


def public_group() -> APIRouter:
    return _router(PUBLIC, [])


def auth_group() -> APIRouter:
    return _router(AUTH, [Depends(get_current_user)])


def cron_group() -> APIRouter:
    return _router(CRON, [Depends(verify_cron_secret)])
