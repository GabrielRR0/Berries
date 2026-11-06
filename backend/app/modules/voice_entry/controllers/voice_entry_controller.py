from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.common.security import get_current_user
from app.database import get_db
from app.modules.auth import User
from app.modules.transactions import DraftResource
from app.modules.voice_entry.contracts.dto import SubmitVoiceEntryDto
from app.modules.voice_entry.services.voice_entry_service import submit_voice_entry

router = APIRouter()


@router.post("", response_model=DraftResource, status_code=status.HTTP_201_CREATED)
async def create(
    payload: SubmitVoiceEntryDto,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DraftResource:
    draft = submit_voice_entry(db, current_user.id, current_user.default_currency, payload.transcript)
    return DraftResource.model_validate(draft)
