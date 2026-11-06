from fastapi import APIRouter

from app.modules.wallets import wallets_routers


def register(api: APIRouter) -> None:
    for router in wallets_routers:
        api.include_router(router, prefix="/wallets", tags=["wallets"])
