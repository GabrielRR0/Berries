from fastapi import APIRouter

from app.modules.health.controllers.public.health_controller import router


def register(api: APIRouter) -> None:
    api.include_router(router)
