# contracts/ — transactions

Todo lo que entra y sale por HTTP, y nada más. No importa de controllers ni de services (solo al revés).

## `dto/` — lo que ENTRA (body y query, validado por Pydantic)

- `bulk_create_drafts_dto.py` — `BulkCreateDraftsDto`
- `bulk_create_transactions_dto.py` — `BulkCreateTransactionsDto`
- `confirm_draft_dto.py` — `ConfirmDraftDto`
- `confirm_draft_transfer_dto.py` — `ConfirmDraftTransferDto`
- `create_transaction_dto.py` — `CreateTransactionDto`
- `draft_create_item_dto.py` — `DraftCreateItemDto`
- `duplicate_check_dto.py` — `DuplicateCheckDto`
- `update_draft_dto.py` — `UpdateDraftDto`
- `update_transaction_dto.py` — `UpdateTransactionDto`

## `resources/` — lo que SALE (una clase por respuesta)

- `draft_resource.py` — `DraftResource`
- `duplicate_check_resource.py` — `DuplicateCheckResource`
- `transaction_resource.py` — `TransactionResource`
