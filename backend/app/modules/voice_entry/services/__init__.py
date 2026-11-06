"""Fachada del módulo: los controllers y la API pública solo hablan con esto."""

from app.modules.voice_entry.services.correction.correction_service import correct_transcript
from app.modules.voice_entry.services.voice_entry_service import submit_voice_entry

__all__ = ["correct_transcript", "submit_voice_entry"]
