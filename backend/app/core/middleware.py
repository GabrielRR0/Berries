import re

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from app.config import settings

MAX_BODY_BYTES = 15 * 1024 * 1024  # 15MB — cubre fotos de recibos y notas de voz cortas

# Cualquier puerto de localhost/127.0.0.1 en dev — un vite dev server puede arrancar en
# 5173, 5174, 5175... si el puerto de al lado ya está ocupado por otro proyecto hermano
# del portafolio corriendo en simultáneo. Exportado (sin "_" adelante) porque main.py
# también lo usa para CORS — un solo patrón, no dos copias que puedan desincronizarse.
# Segunda alternativa: dominios de tunel publico (pedido explicito del usuario - probar
# la app desde su telefono via cloudflared/localtunnel, que no esta en la misma red
# WiFi). El navegador del telefono manda su Origin real (el del tunel) incluso pasando
# por el proxy /api de Vite, que no lo reescribe - sin esto, cualquier request desde el
# telefono se rechaza con 403 "Origen no permitido" aunque el tunel funcione bien.
LOCAL_ORIGIN_PATTERN = (
    r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$"
    r"|^https://[a-z0-9-]+\.(trycloudflare\.com|loca\.lt)$"
)
_LOCAL_ORIGIN_RE = re.compile(LOCAL_ORIGIN_PATTERN)


class BodySizeLimitMiddleware(BaseHTTPMiddleware):
    """Rechaza requests con Content-Length declarado por encima del límite antes de
    leer el body — evita que un upload gigante consuma memoria de la función serverless."""

    async def dispatch(self, request: Request, call_next):
        content_length = request.headers.get("content-length")
        if content_length is not None and int(content_length) > MAX_BODY_BYTES:
            return JSONResponse(status_code=413, content={"detail": "Archivo demasiado grande"})
        return await call_next(request)


class OriginCheckMiddleware(BaseHTTPMiddleware):
    """Capa extra adyacente a CORS: en dev permite cualquier puerto de localhost/127.0.0.1,
    en producción exige coincidencia exacta con FRONTEND_URL."""

    async def dispatch(self, request: Request, call_next):
        origin = request.headers.get("origin")
        if origin is not None:
            allowed = _LOCAL_ORIGIN_RE.match(origin) if settings.environment != "production" else origin == settings.frontend_url
            if not allowed:
                return JSONResponse(status_code=403, content={"detail": "Origen no permitido"})
        return await call_next(request)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        return response
