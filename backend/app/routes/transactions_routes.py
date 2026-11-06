from fastapi import APIRouter

from app.modules.transactions import transactions_routers


def register(api: APIRouter) -> None:
    for router in transactions_routers:
        api.include_router(router, prefix="/transactions", tags=["transactions"])
