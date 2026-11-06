"""Lo que ENTRA por HTTP: un modelo por caso."""

from app.modules.transactions.contracts.dto.bulk_create_drafts_dto import BulkCreateDraftsDto
from app.modules.transactions.contracts.dto.bulk_create_transactions_dto import BulkCreateTransactionsDto
from app.modules.transactions.contracts.dto.confirm_draft_dto import ConfirmDraftDto
from app.modules.transactions.contracts.dto.confirm_draft_transfer_dto import ConfirmDraftTransferDto
from app.modules.transactions.contracts.dto.create_transaction_dto import CreateTransactionDto
from app.modules.transactions.contracts.dto.draft_create_item_dto import DraftCreateItemDto
from app.modules.transactions.contracts.dto.duplicate_check_dto import DuplicateCheckDto
from app.modules.transactions.contracts.dto.update_draft_dto import UpdateDraftDto
from app.modules.transactions.contracts.dto.update_transaction_dto import UpdateTransactionDto

__all__ = [
    "BulkCreateDraftsDto",
    "BulkCreateTransactionsDto",
    "ConfirmDraftDto",
    "ConfirmDraftTransferDto",
    "CreateTransactionDto",
    "DraftCreateItemDto",
    "DuplicateCheckDto",
    "UpdateDraftDto",
    "UpdateTransactionDto",
]
