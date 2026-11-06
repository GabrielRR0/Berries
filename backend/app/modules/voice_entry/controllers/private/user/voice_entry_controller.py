from fastapi import status

from app.common.security import CurrentUser, auth_group
from app.database import DbSession
from app.modules.transactions import DraftResource
from app.modules.voice_entry import services
from app.modules.voice_entry.contracts.dto import SubmitVoiceEntryDto

router = auth_group()


@router.post("", response_model=DraftResource, status_code=status.HTTP_201_CREATED)
async def create(payload: SubmitVoiceEntryDto, db: DbSession, user: CurrentUser) -> DraftResource:
    draft = services.submit_voice_entry(db, user.id, user.default_currency, payload.transcript)
    return DraftResource.model_validate(draft)
