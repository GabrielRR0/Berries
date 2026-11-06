from fastapi import APIRouter

from app.modules.categories import categories_routers


def register(api: APIRouter) -> None:
    for router in categories_routers:
        api.include_router(router, prefix="/categories", tags=["categories"])
