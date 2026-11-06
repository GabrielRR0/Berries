from fastapi import APIRouter

from app.modules.goals import goals_routers


def register(api: APIRouter) -> None:
    for router in goals_routers:
        api.include_router(router, prefix="/goals", tags=["goals"])
