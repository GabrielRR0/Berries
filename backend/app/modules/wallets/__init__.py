"""Billeteras y transferencias entre ellas.

Lo único que otros módulos pueden importar (ver app/common/modules/public_api.py).
"""

from typing import TYPE_CHECKING

from app.common.modules import public_api

if TYPE_CHECKING:
    from app.modules.wallets.controllers import wallets_routers
    from app.modules.wallets.errors import CurrencyMismatchError, InsufficientBalanceError, WalletNotFoundError
    from app.modules.wallets.models import Wallet
    from app.modules.wallets.services import create_wallet, execute_transfer, get_wallet_owned_by_user, list_wallets_for_user
    from app.modules.wallets.utils.transfer_labels import FEE_CATEGORY

__getattr__, __dir__, __all__ = public_api(__name__, __file__)
