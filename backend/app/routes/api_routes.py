from fastapi import APIRouter

from app.routes import (
    analytics_routes,
    auth_routes,
    categories_routes,
    currency_routes,
    debts_routes,
    goals_routes,
    health_routes,
    receipt_scanner_routes,
    transactions_routes,
    voice_entry_routes,
    wallets_routes,
)

# Todo cuelga de /api. Para agregar un módulo: crear routes/<modulo>_routes.py e
# incluirlo acá.
api_router = APIRouter(prefix="/api")

for routes in (
    auth_routes,
    wallets_routes,
    transactions_routes,
    categories_routes,
    currency_routes,
    debts_routes,
    goals_routes,
    analytics_routes,
    voice_entry_routes,
    receipt_scanner_routes,
    health_routes,
):
    routes.register(api_router)
