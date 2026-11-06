from fastapi import APIRouter

from app.modules.analytics.controllers.analytics_controller import router


def register(api: APIRouter) -> None:
    api.include_router(router, prefix="/analytics", tags=["analytics"])
