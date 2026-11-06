from fastapi import APIRouter

from app.modules.voice_entry import voice_entry_routers


def register(api: APIRouter) -> None:
    for router in voice_entry_routers:
        api.include_router(router, prefix="/voice-entry", tags=["voiceEntry"])
