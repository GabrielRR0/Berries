"""Lo que SALE por HTTP: un modelo por respuesta."""

from app.modules.wallets.contracts.resources.transfer_resource import TransferResource
from app.modules.wallets.contracts.resources.wallet_resource import WalletResource
from app.modules.wallets.contracts.resources.wallet_statement_entry_resource import WalletStatementEntryResource
from app.modules.wallets.contracts.resources.wallet_statement_resource import WalletStatementResource

__all__ = [
    "TransferResource",
    "WalletResource",
    "WalletStatementEntryResource",
    "WalletStatementResource",
]
