import uuid
from decimal import Decimal

from pydantic import BaseModel

from app.modules.wallets.contracts.resources.wallet_statement_entry_resource import WalletStatementEntryResource


class WalletStatementResource(BaseModel):
    wallet_id: uuid.UUID
    wallet_name: str
    currency: str
    # Saldo que tiene la billetera hoy (el que ve el usuario en Cuentas).
    current_balance: Decimal
    # Saldo que tenía antes del primer movimiento registrado: lo que quedó fuera de
    # Berry (saldo inicial al crear la billetera, ajustes directos...). Se deduce como
    # saldo actual menos el neto de todos los movimientos.
    opening_balance: Decimal
    # Del más reciente al más antiguo.
    entries: list[WalletStatementEntryResource]
