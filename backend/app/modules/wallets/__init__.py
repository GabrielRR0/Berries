"""Billeteras y transferencias entre ellas.

Lo único que otros módulos pueden importar (ver app/common/modules/public_api.py).
"""

from typing import TYPE_CHECKING

from app.common.modules import public_api

if TYPE_CHECKING:
    from app.modules.wallets.errors import CurrencyMismatchError, InsufficientBalanceError, WalletNotFoundError
    from app.modules.wallets.models.wallet_model import Wallet
    from app.modules.wallets.services.transfer_service import FEE_CATEGORY, execute_transfer
    from app.modules.wallets.services.wallet_service import create_wallet, get_wallet_owned_by_user, list_wallets_for_user

__getattr__, __dir__, __all__ = public_api(__name__, __file__)
