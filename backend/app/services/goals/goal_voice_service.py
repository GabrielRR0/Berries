import uuid
from datetime import date

from sqlalchemy.orm import Session

from app.services.goals.goal_entity_parser import ParsedGoalEntities, parse_goal_entities
from app.services.voiceEntry.correction.correction_service import correct_transcript


def parse_goal_voice_entry(db: Session, user_id: uuid.UUID, default_currency: str, transcript: str) -> ParsedGoalEntities:
    """Sin persistencia (a diferencia de submit_voice_entry, que crea un
    TransactionDraft): una meta es una unica accion de alta deliberada, no una cola de
    borradores para revisar en lote mas tarde - el propio BottomSheet + formulario de
    creacion, prellenado con este resultado, ya es el paso de revision editable."""
    corrected = correct_transcript(db, user_id, transcript).text
    return parse_goal_entities(corrected, default_currency, today=date.today())
