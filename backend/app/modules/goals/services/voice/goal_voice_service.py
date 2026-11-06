"""Entender una meta dicha por voz para precargar el formulario (no guarda nada)."""

import uuid
from datetime import date

from sqlalchemy.orm import Session

from app.modules.goals.contracts.resources import GoalVoicePreviewResource
from app.modules.goals.services.voice.goal_entity_parser import ParsedGoalEntities, parse_goal_entities
from app.modules.voice_entry import correct_transcript


def parse_goal_voice_entry(db: Session, user_id: uuid.UUID, default_currency: str, transcript: str) -> ParsedGoalEntities:
    """Sin persistencia (a diferencia de submit_voice_entry, que crea un
    TransactionDraft): una meta es una unica accion de alta deliberada, no una cola de
    borradores para revisar en lote mas tarde - el propio BottomSheet + formulario de
    creacion, prellenado con este resultado, ya es el paso de revision editable."""
    corrected = correct_transcript(db, user_id, transcript).text
    return parse_goal_entities(corrected, default_currency, today=date.today())


def preview_goal_from_voice(db: Session, user_id: uuid.UUID, default_currency: str, transcript: str) -> GoalVoicePreviewResource:
    """Lo que devuelve POST /goals/voice-preview: no guarda nada, solo precarga el
    formulario de crear meta."""
    parsed = parse_goal_voice_entry(db, user_id, default_currency, transcript)
    return GoalVoicePreviewResource(
        title=parsed.title,
        amount=parsed.amount,
        amount_is_monthly=parsed.amount_is_monthly,
        currency=parsed.currency,
        target_date=parsed.target_date,
    )
