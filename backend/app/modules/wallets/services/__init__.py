"""Fachada del módulo: los controllers y la API pública solo hablan con esto."""

from app.modules.wallets.services.transfers.transfer_create import execute_transfer
from app.modules.wallets.services.transfers.transfer_update import update_transfer
from app.modules.wallets.services.wallet_service import (
    create_wallet,
    delete_wallet,
    get_wallet_owned_by_user,
    list_wallets_for_user,
)

__all__ = [
    "create_wallet",
    "delete_wallet",
    "execute_transfer",
    "get_wallet_owned_by_user",
    "list_wallets_for_user",
    "update_transfer",
]
