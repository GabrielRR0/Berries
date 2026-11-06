from fastapi import APIRouter

from app.modules.currency import cron_routers, currency_routers


def register(api: APIRouter) -> None:
    for router in currency_routers:
        api.include_router(router, prefix="/currency", tags=["currency"])
    for router in cron_routers:
        api.include_router(router, prefix="/cron", tags=["cron"])
