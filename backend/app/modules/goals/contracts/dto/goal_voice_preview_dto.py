from pydantic import BaseModel, Field


class GoalVoicePreviewDto(BaseModel):
    transcript: str = Field(min_length=1, max_length=2000)
