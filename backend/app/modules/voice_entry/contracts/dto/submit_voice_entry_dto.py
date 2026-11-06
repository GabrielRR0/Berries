from pydantic import BaseModel, Field


class SubmitVoiceEntryDto(BaseModel):
    """La transcripción ya viene hecha del lado del navegador (Web Speech API) — el
    backend nunca recibe ni procesa audio, solo el texto ya reconocido."""

    transcript: str = Field(min_length=1, max_length=2000)
