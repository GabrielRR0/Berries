from fastapi import FastAPI, Request
from starlette.responses import JSONResponse


class DomainError(Exception):
    """Base de los errores de negocio. Cada módulo declara los suyos en `errors.py`
    con el código HTTP que les toca:

        class WalletNotFoundError(DomainError):
            status_code = 404

    El service lanza el error sin saber de HTTP; el manejador global lo traduce a
    `{"detail": "<mensaje>"}` con ese código. Así los controllers no necesitan
    `try/except`."""

    status_code: int = 400


def _handle_domain_error(_request: Request, exc: DomainError) -> JSONResponse:
    return JSONResponse(status_code=exc.status_code, content={"detail": str(exc)})


def register_error_handlers(app: FastAPI) -> None:
    app.add_exception_handler(DomainError, _handle_domain_error)
