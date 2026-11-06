from fastapi import APIRouter

from app.modules.health import health_routers


def register(api: APIRouter) -> None:
    for router in health_routers:
        api.include_router(router)
