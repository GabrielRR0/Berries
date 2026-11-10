# contracts/ — wallets

Todo lo que entra y sale por HTTP, y nada más. No importa de controllers ni de services (solo al revés).

## `dto/` — lo que ENTRA (body y query, validado por Pydantic)

- `create_transfer_dto.py` — `CreateTransferDto`
- `create_wallet_dto.py` — `CreateWalletDto`
- `update_transfer_dto.py` — `UpdateTransferDto`

## `resources/` — lo que SALE (una clase por respuesta)

- `transfer_resource.py` — `TransferResource`
- `wallet_resource.py` — `WalletResource`
- `wallet_statement_entry_resource.py` — `WalletStatementEntryResource`
- `wallet_statement_resource.py` — `WalletStatementResource`
