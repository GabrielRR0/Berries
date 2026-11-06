from pydantic import BaseModel, Field


class ParseDebtPaymentVoiceDto(BaseModel):
    transcript: str = Field(min_length=1)
