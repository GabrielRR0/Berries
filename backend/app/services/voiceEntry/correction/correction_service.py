"""Capa de correccion de transcripciones, COMPARTIDA entre el registro por voz de
movimientos (voice_entry_service.py) y el de metas (goal_voice_service.py) - un solo
lugar, sin duplicar. Corre UNA sola vez, del lado del servidor, justo antes de la
extraccion de entidades. Deliberadamente no corre una segunda vez en ningun otro punto
del flujo: si corriera de nuevo al confirmar, un usuario que reescribio "vaina" a mano
queriendo decir literal esa palabra podria terminar re-corregido en contra de su
voluntad. El textarea editable del transcript (ya existente en VoiceRecorderModal.vue)
sigue siendo la red de seguridad real ante una correccion equivocada."""

import re
import uuid
from dataclasses import dataclass, field

from sqlalchemy.orm import Session

from app.services.voiceEntry.correction.rules.personal_vocabulary import build_user_vocabulary, correct_against_vocabulary
from app.services.voiceEntry.correction.rules.static_terms import GLOBAL_TERM_RULES


@dataclass
class CorrectionResult:
    text: str
    corrections: list[tuple[str, str]] = field(default_factory=list)  # (original, corregido)


def correct_transcript(db: Session, user_id: uuid.UUID, transcript: str) -> CorrectionResult:
    corrected = transcript
    for pattern, replacement in GLOBAL_TERM_RULES:
        corrected = re.sub(pattern, replacement, corrected, flags=re.IGNORECASE)

    vocabulary = build_user_vocabulary(db, user_id)
    corrected, personal_corrections = correct_against_vocabulary(corrected, vocabulary)

    return CorrectionResult(text=corrected, corrections=personal_corrections)
