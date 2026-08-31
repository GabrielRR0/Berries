from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from starlette.responses import JSONResponse

from app.config import settings
from app.core.middleware import (
    LOCAL_ORIGIN_PATTERN,
    BodySizeLimitMiddleware,
    OriginCheckMiddleware,
    SecurityHeadersMiddleware,
)
from app.core.rate_limit import limiter
from app.routers.analytics.analytics_router import router as analytics_router
from app.routers.auth.auth_router import router as auth_router
from app.routers.currency.currency_router import router as currency_router
from app.routers.debts.debts_router import router as debts_router
from app.routers.goals.goals_router import router as goals_router
from app.routers.receiptScanner.receipt_scanner_router import router as receipt_scanner_router
from app.routers.transactions.categories_router import router as categories_router
from app.routers.transactions.transactions_router import router as transactions_router
from app.routers.voiceEntry.voice_entry_router import router as voice_entry_router
from app.routers.wallets.wallets_router import router as wallets_router

# Docs interactivas (/docs, /redoc, /openapi.json) solo en desarrollo - en producción
# no aportan nada al usuario final y sí le dan a cualquiera que las visite el mapa
# completo de endpoints/schemas de la API sin necesidad de autenticarse primero.
_is_production = settings.environment == "production"
app = FastAPI(
    title="Berries API",
    docs_url=None if _is_production else "/docs",
    redoc_url=None if _is_production else "/redoc",
    openapi_url=None if _is_production else "/openapi.json",
)

app.state.limiter = limiter


@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request, exc):
    return JSONResponse(status_code=429, content={"detail": "Demasiadas solicitudes, intenta de nuevo más tarde"})


# Orden deliberado (igual patrón que s-rank/tayuya-check): rate limit -> body size ->
# origin -> security headers -> CORS al final, para que CORS quede como capa más externa
# y sus headers lleguen incluso a respuestas rechazadas por las capas anteriores.
app.add_middleware(SlowAPIMiddleware)
app.add_middleware(BodySizeLimitMiddleware)
app.add_middleware(OriginCheckMiddleware)
app.add_middleware(SecurityHeadersMiddleware)

# En dev, un vite dev server puede terminar en cualquier puerto libre (5173, 5174...) si
# el de al lado ya está tomado por otro proyecto hermano corriendo a la vez — por eso
# se usa un regex de cualquier puerto localhost, igual criterio que OriginCheckMiddleware,
# en vez de un allow_origins fijo a FRONTEND_URL (que sí se exige tal cual en producción).
_cors_kwargs = (
    {"allow_origins": [settings.frontend_url]}
    if settings.environment == "production"
    else {"allow_origin_regex": LOCAL_ORIGIN_PATTERN}
)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    **_cors_kwargs,
)

app.include_router(auth_router, prefix="/api/auth", tags=["auth"])
app.include_router(wallets_router, prefix="/api/wallets", tags=["wallets"])
app.include_router(transactions_router, prefix="/api/transactions", tags=["transactions"])
app.include_router(categories_router, prefix="/api/categories", tags=["categories"])
app.include_router(currency_router, prefix="/api/currency", tags=["currency"])
app.include_router(debts_router, prefix="/api/debts", tags=["debts"])
app.include_router(goals_router, prefix="/api/goals", tags=["goals"])
app.include_router(analytics_router, prefix="/api/analytics", tags=["analytics"])
app.include_router(voice_entry_router, prefix="/api/voice-entry", tags=["voiceEntry"])
app.include_router(receipt_scanner_router, prefix="/api/receipt-scanner", tags=["receiptScanner"])


@app.get("/api/health")
async def health():
    return {"status": "ok"}
