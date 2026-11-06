"""Lo que ENTRA por HTTP: un modelo por caso."""

from app.modules.wallets.contracts.dto.create_transfer_dto import CreateTransferDto
from app.modules.wallets.contracts.dto.create_wallet_dto import CreateWalletDto
from app.modules.wallets.contracts.dto.update_transfer_dto import UpdateTransferDto

__all__ = [
    "CreateTransferDto",
    "CreateWalletDto",
    "UpdateTransferDto",
]
