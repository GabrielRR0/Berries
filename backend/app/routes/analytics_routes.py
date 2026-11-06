from fastapi import APIRouter

from app.modules.analytics import analytics_routers


def register(api: APIRouter) -> None:
    for router in analytics_routers:
        api.include_router(router, prefix="/analytics", tags=["analytics"])
