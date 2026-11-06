from fastapi import APIRouter

from app.modules.transactions.controllers.transactions_controller import router


def register(api: APIRouter) -> None:
    api.include_router(router, prefix="/transactions", tags=["transactions"])
