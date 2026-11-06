from fastapi import APIRouter

from app.modules.debts.controllers.debts_controller import router


def register(api: APIRouter) -> None:
    api.include_router(router, prefix="/debts", tags=["debts"])
