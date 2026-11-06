from fastapi import APIRouter

from app.modules.categories.controllers.categories_controller import router


def register(api: APIRouter) -> None:
    api.include_router(router, prefix="/categories", tags=["categories"])
