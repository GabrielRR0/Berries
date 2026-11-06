from fastapi import APIRouter

from app.modules.auth import auth_routers


def register(api: APIRouter) -> None:
    for router in auth_routers:
        api.include_router(router, prefix="/auth", tags=["auth"])
