from slowapi import Limiter
from starlette.requests import Request


def get_client_ip(request: Request) -> str:
    """Resuelve la IP real detrás del proxy de Vercel (X-Forwarded-For)."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


# default_limits aplica a TODOS los endpoints automaticamente via SlowAPIMiddleware
# (ver app/main.py) - antes solo /register y /login (10/minute cada uno, mas estrictos,
# ver auth_router.py) tenian algun limite; el resto de la API (wallets, transacciones,
# deudas, metas, etc.) no tenia ninguno. Pedido explicito del usuario de proteger todos
# los endpoints - 60/minute es generoso para uso normal (una sola carga del dashboard
# dispara varios GET en paralelo) pero pone un techo real contra scraping/abuso con un
# token robado o de fuerza bruta sobre IDs.
limiter = Limiter(key_func=get_client_ip, default_limits=["60/minute"])
