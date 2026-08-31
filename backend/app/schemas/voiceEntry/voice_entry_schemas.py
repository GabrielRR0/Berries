# El registro por voz produce el mismo tipo de fila (TransactionDraft) que ya modela
# app.schemas.transactions.transaction_schemas.DraftResponse — se reimporta acá en vez
# de redefinir un schema idéntico, así el router de voiceEntry no necesita conocer el
# módulo de transactions directamente.
from pydantic import BaseModel, Field

from app.schemas.transactions.transaction_schemas import DraftResponse

__all__ = ["DraftResponse", "VoiceEntrySubmitRequest"]


class VoiceEntrySubmitRequest(BaseModel):
    """La transcripción ya viene hecha del lado del navegador (Web Speech API) — el
    backend nunca recibe ni procesa audio, solo el texto ya reconocido."""

    transcript: str = Field(min_length=1, max_length=2000)
