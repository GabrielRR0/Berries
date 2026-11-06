from fastapi import APIRouter

from app.modules.debts import debts_routers


def register(api: APIRouter) -> None:
    for router in debts_routers:
        api.include_router(router, prefix="/debts", tags=["debts"])
