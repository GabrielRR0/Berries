"""Cuánto se movió en cada billetera durante un mes."""

import uuid
from decimal import Decimal
from typing import Literal

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.modules.analytics.contracts.resources import WalletBreakdownItemResource
from app.modules.analytics.services.period_totals import WalletCurrencyConverter, transactions_in_range, user_default_currency
from app.modules.analytics.utils.months import month_bounds, resolve_month
from app.modules.wallets import Wallet


def get_wallet_breakdown(
    db: Session, user_id: uuid.UUID, kind: Literal["income", "expense"] = "expense", month: str | None = None
) -> list[WalletBreakdownItemResource]:
    """Total por billetera (convertido a la moneda del usuario), de mayor a menor. Solo
    aparecen las billeteras con movimientos en el mes; `percentage` es su parte del total."""
    start, end = month_bounds(resolve_month(month))
    converter = WalletCurrencyConverter(db, user_id, user_default_currency(db, user_id))

    totals: dict[uuid.UUID, Decimal] = {}
    counts: dict[uuid.UUID, int] = {}
    for row in transactions_in_range(db, user_id, kind, start, end):
        totals[row.wallet_id] = totals.get(row.wallet_id, Decimal("0")) + converter.amount_of(row)
        counts[row.wallet_id] = counts.get(row.wallet_id, 0) + 1

    wallets = {
        wallet.id: wallet
        for wallet in db.scalars(
            select(Wallet).options(joinedload(Wallet.currency_ref)).where(Wallet.user_id == user_id)
        )
    }
    grand_total = sum(totals.values(), Decimal("0"))
    items = [
        WalletBreakdownItemResource(
            wallet_id=wallet_id,
            name=wallets[wallet_id].name if wallet_id in wallets else "Billetera eliminada",
            currency=wallets[wallet_id].currency if wallet_id in wallets else "",
            total=total,
            percentage=float(total / grand_total * 100) if grand_total > 0 else 0.0,
            count=counts[wallet_id],
        )
        for wallet_id, total in totals.items()
    ]
    items.sort(key=lambda item: item.total, reverse=True)
    return items
