from fastapi import APIRouter

from app.modules.auth.controllers.auth_controller import router


def register(api: APIRouter) -> None:
    api.include_router(router, prefix="/auth", tags=["auth"])
