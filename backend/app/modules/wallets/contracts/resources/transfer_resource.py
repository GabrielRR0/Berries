from pydantic import BaseModel

from app.modules.wallets.contracts.resources.wallet_resource import WalletResource


class TransferResource(BaseModel):
    from_wallet: WalletResource
    to_wallet: WalletResource
