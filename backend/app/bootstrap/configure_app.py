from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.responses import JSONResponse

from app.common.errors import register_error_handlers
from app.common.security import limiter
from app.common.security.middleware import (
    LOCAL_ORIGIN_PATTERN,
    BodySizeLimitMiddleware,
    OriginCheckMiddleware,
    SecurityHeadersMiddleware,
)
from app.config import settings
from app.database import registry  # noqa: F401 — registra todos los modelos antes de la primera consulta
from app.routes import api_router
from app.support.rate_limit_support import RateLimitExceeded, RateLimitMiddleware


async def _rate_limit_handler(_request, _exc):
    return JSONResponse(status_code=429, content={"detail": "Demasiadas solicitudes, intenta de nuevo más tarde"})


def create_app() -> FastAPI:
    # Docs interactivas (/docs, /redoc, /openapi.json) solo en desarrollo - en producción
    # no aportan nada al usuario final y sí le dan a cualquiera que las visite el mapa
    # completo de endpoints/schemas de la API sin necesidad de autenticarse primero.
    is_production = settings.environment == "production"
    app = FastAPI(
        title="Berries API",
        docs_url=None if is_production else "/docs",
        redoc_url=None if is_production else "/redoc",
        openapi_url=None if is_production else "/openapi.json",
    )

    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_handler)
    register_error_handlers(app)

    # Orden deliberado (igual patrón que s-rank/tayuya-check): rate limit -> body size ->
    # origin -> security headers -> CORS al final, para que CORS quede como capa más externa
    # y sus headers lleguen incluso a respuestas rechazadas por las capas anteriores.
    app.add_middleware(RateLimitMiddleware)
    app.add_middleware(BodySizeLimitMiddleware)
    app.add_middleware(OriginCheckMiddleware)
    app.add_middleware(SecurityHeadersMiddleware)

    # En dev, un vite dev server puede terminar en cualquier puerto libre (5173, 5174...) si
    # el de al lado ya está tomado por otro proyecto hermano corriendo a la vez — por eso
    # se usa un regex de cualquier puerto localhost, igual criterio que OriginCheckMiddleware,
    # en vez de un allow_origins fijo a FRONTEND_URL (que sí se exige tal cual en producción).
    cors_kwargs = (
        {"allow_origins": [settings.frontend_url]} if is_production else {"allow_origin_regex": LOCAL_ORIGIN_PATTERN}
    )
    app.add_middleware(
        CORSMiddleware,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        **cors_kwargs,
    )

    app.include_router(api_router)
    return app
