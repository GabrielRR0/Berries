from fastapi import APIRouter

from app.modules.voice_entry.controllers.voice_entry_controller import router


def register(api: APIRouter) -> None:
    api.include_router(router, prefix="/voice-entry", tags=["voiceEntry"])
