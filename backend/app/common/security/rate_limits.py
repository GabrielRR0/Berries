from starlette.requests import Request

from app.support.rate_limit_support import Limiter


def get_client_ip(request: Request) -> str:
    """Resuelve la IP real detrás del proxy de Vercel (X-Forwarded-For)."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


# default_limits aplica a TODOS los endpoints automaticamente via RateLimitMiddleware
# (ver app/bootstrap/configure_app.py) - antes solo /register y /login (10/minute cada
# uno, mas estrictos, ver AUTH_ENDPOINT_LIMIT) tenian algun limite; el resto de la API
# (wallets, transacciones, deudas, metas, etc.) no tenia ninguno. Pedido explicito del
# usuario de proteger todos los endpoints - 60/minute es generoso para uso normal (una
# sola carga del dashboard dispara varios GET en paralelo) pero pone un techo real
# contra scraping/abuso con un token robado o de fuerza bruta sobre IDs.
limiter = Limiter(key_func=get_client_ip, default_limits=["60/minute"])

# /register y /login son el blanco más valioso para fuerza bruta.
AUTH_ENDPOINT_LIMIT = "10/minute"
