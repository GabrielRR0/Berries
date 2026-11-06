from fastapi import APIRouter

from app.modules.currency.controllers.cron_controller import router as cron_router
from app.modules.currency.controllers.currency_controller import router


def register(api: APIRouter) -> None:
    api.include_router(router, prefix="/currency", tags=["currency"])
    api.include_router(cron_router, prefix="/cron", tags=["cron"])
