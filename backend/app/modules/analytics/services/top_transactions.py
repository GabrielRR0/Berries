"""Los movimientos más grandes de un mes."""

import uuid
from typing import Literal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.analytics.contracts.resources import TopTransactionResource
from app.modules.analytics.services.period_totals import WalletCurrencyConverter, transactions_in_range, user_default_currency
from app.modules.analytics.utils.months import month_bounds, resolve_month
from app.modules.wallets import Wallet


def get_top_transactions(
    db: Session,
    user_id: uuid.UUID,
    kind: Literal["income", "expense"] = "expense",
    month: str | None = None,
    limit: int = 5,
) -> list[TopTransactionResource]:
    """Los `limit` movimientos de mayor monto del mes, ya convertidos a la moneda del usuario."""
    limit = max(1, min(limit, 50))
    start, end = month_bounds(resolve_month(month))
    converter = WalletCurrencyConverter(db, user_id, user_default_currency(db, user_id))

    priced = [(row, converter.amount_of(row)) for row in transactions_in_range(db, user_id, kind, start, end)]
    priced.sort(key=lambda pair: pair[1], reverse=True)

    wallet_names = {
        wallet_id: name for wallet_id, name in db.execute(select(Wallet.id, Wallet.name).where(Wallet.user_id == user_id))
    }
    return [
        TopTransactionResource(
            id=row.id,
            occurred_at=row.occurred_at,
            category=row.category,
            description=row.description,
            wallet_name=wallet_names.get(row.wallet_id, "Billetera eliminada"),
            amount=amount,
        )
        for row, amount in priced[:limit]
    ]
