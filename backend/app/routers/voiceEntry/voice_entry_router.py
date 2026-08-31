from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.models.auth.user_model import User
from app.schemas.voiceEntry.voice_entry_schemas import DraftResponse, VoiceEntrySubmitRequest
from app.services.voiceEntry.voice_entry_service import submit_voice_entry

router = APIRouter()


@router.post("", response_model=DraftResponse, status_code=status.HTTP_201_CREATED)
async def create(
    payload: VoiceEntrySubmitRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DraftResponse:
    draft = submit_voice_entry(db, current_user.id, current_user.default_currency, payload.transcript)
    return DraftResponse.model_validate(draft)
