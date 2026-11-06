from pydantic import BaseModel, Field

from app.modules.transactions.contracts.dto.draft_create_item_dto import DraftCreateItemDto


class BulkCreateDraftsDto(BaseModel):
    items: list[DraftCreateItemDto] = Field(min_length=1, max_length=100)
