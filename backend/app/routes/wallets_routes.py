from fastapi import APIRouter

from app.modules.wallets.controllers.wallets_controller import router


def register(api: APIRouter) -> None:
    api.include_router(router, prefix="/wallets", tags=["wallets"])
