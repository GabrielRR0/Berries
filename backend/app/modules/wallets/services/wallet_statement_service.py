"""Cartola de una billetera: sus movimientos con el saldo corrido."""

import uuid
from decimal import Decimal

from sqlalchemy.orm import Session

from app.modules.transactions import list_transactions_for_user
from app.modules.wallets.contracts.resources import WalletStatementEntryResource, WalletStatementResource
from app.modules.wallets.services.wallet_service import get_wallet_owned_by_user


def get_wallet_statement(db: Session, wallet_id: uuid.UUID, user_id: uuid.UUID) -> WalletStatementResource:
    """Todos los movimientos de la billetera, del más reciente al más antiguo, cada uno
    con el saldo antes y después de aplicarse.

    El saldo se ancla en el saldo ACTUAL de la billetera y se recorre hacia atrás: así
    la última fila siempre termina exactamente en lo que muestra Cuentas, y lo que no
    explican los movimientos (saldo inicial, ajustes directos) queda visible como
    `opening_balance` en vez de esconderse."""
    wallet = get_wallet_owned_by_user(db, wallet_id, user_id)
    transactions = list_transactions_for_user(db, user_id, wallet_id=wallet_id)
    # Cronológico; a igual fecha (las patas de una transferencia comparten occurred_at),
    # el orden en que se registraron.
    ordered = sorted(transactions, key=lambda t: (t.occurred_at, t.created_at))

    net = sum((t.amount if t.type == "income" else -t.amount for t in ordered), Decimal("0"))
    opening_balance = wallet.balance - net

    entries: list[WalletStatementEntryResource] = []
    running = opening_balance
    for transaction in ordered:
        before = running
        running = before + transaction.amount if transaction.type == "income" else before - transaction.amount
        entries.append(
            WalletStatementEntryResource(
                id=transaction.id,
                type=transaction.type,
                amount=transaction.amount,
                balance_before=before,
                balance_after=running,
                category=transaction.category,
                description=transaction.description,
                occurred_at=transaction.occurred_at,
                source=transaction.source,
                transfer_id=transaction.transfer_id,
                reference_amount_usd=transaction.reference_amount_usd,
            )
        )
    entries.reverse()

    return WalletStatementResource(
        wallet_id=wallet.id,
        wallet_name=wallet.name,
        currency=wallet.currency,
        current_balance=wallet.balance,
        opening_balance=opening_balance,
        entries=entries,
    )

