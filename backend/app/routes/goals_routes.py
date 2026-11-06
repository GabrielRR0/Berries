from fastapi import APIRouter

from app.modules.goals.controllers.goals_controller import router


def register(api: APIRouter) -> None:
    api.include_router(router, prefix="/goals", tags=["goals"])
