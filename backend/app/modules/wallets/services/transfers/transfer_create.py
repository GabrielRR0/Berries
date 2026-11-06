"""Crear una transferencia entre dos billeteras del mismo usuario."""

import uuid
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy.orm import Session

from app.modules.transactions import Transaction
from app.modules.transactions import seal_import_key
from app.modules.wallets.errors import CurrencyMismatchError, InsufficientBalanceError
from app.modules.wallets.models.wallet_model import Wallet
from app.modules.wallets.services.transfers.transfer_rates import record_transfer_rate_observation
from app.modules.wallets.services.wallet_service import get_wallet_owned_by_user
from app.modules.wallets.utils.transfer_labels import FEE_CATEGORY, TRANSFER_CATEGORY, with_note


def execute_transfer(
    db: Session,
    user_id: uuid.UUID,
    from_wallet_id: uuid.UUID,
    to_wallet_id: uuid.UUID,
    amount: Decimal,
    fee: Decimal = Decimal("0"),
    converted_amount: Decimal | None = None,
    occurred_at: datetime | None = None,
    import_key: str | None = None,
    note: str | None = None,
) -> tuple[Wallet, Wallet]:
    """Debita `from_wallet` y acredita `to_wallet` de forma atómica (un solo commit al
    final) para que un crash a mitad de camino no deje un lado actualizado y el otro no.

    Ademas registra transactions para que la transferencia aparezca en el historial de
    Movimientos - pedido explicito del usuario. Se insertan directo como filas del
    ledger (no via create_transaction()) porque el delta de saldo ya se aplico arriba;
    llamar a create_transaction() ademas lo aplicaria una segunda vez.

    Son 2 filas (expense en from_wallet por `amount`, income en to_wallet), mas una
    TERCERA solo si `fee` > 0: la comision como su propio gasto real, category
    "Comisión", source="manual" (no "transfer") - a diferencia de las 2 patas de la
    transferencia (que son plata que solo cambia de lugar, no un gasto real), la
    comision SI es plata que se pierde, asi que debe contar como gasto real en
    Analisis/Metas (ver analytics/services, que excluye source="transfer") y verse en
    Movimientos como cualquier otro gasto manual (ver TransactionList.vue, que le da
    tratamiento neutro solo a source="transfer"). Las 3 filas comparten `transfer_id`
    para que delete_transaction() las borre/revierta juntas - eliminar la comision
    sola dejaria un gasto "huerfano" sin la transferencia que lo origino."""
    # get_wallet_owned_by_user valida contra el mismo user_id para ambos wallets, lo que
    # ya garantiza "ambos pertenecen al mismo usuario" (el que hace la petición).
    from_wallet = get_wallet_owned_by_user(db, from_wallet_id, user_id)
    to_wallet = get_wallet_owned_by_user(db, to_wallet_id, user_id)

    total_debit = amount + fee
    if from_wallet.balance < total_debit:
        raise InsufficientBalanceError("Saldo insuficiente para esta transferencia")

    if from_wallet.currency == to_wallet.currency:
        credit_amount = amount  # converted_amount se ignora deliberadamente en este caso
    else:
        if converted_amount is None:
            raise CurrencyMismatchError(
                "converted_amount es requerido cuando las billeteras tienen monedas distintas"
            )
        credit_amount = converted_amount

    from_wallet.balance -= total_debit
    to_wallet.balance += credit_amount

    transfer_id = uuid.uuid4()
    # Pedido explicito del usuario: poder elegir la fecha de una transferencia
    # (backdatearla), no solo "ahora" - mismo criterio que create_transaction.
    resolved_occurred_at = occurred_at or datetime.now(timezone.utc)
    db.add(
        Transaction(
            user_id=user_id,
            wallet_id=from_wallet.id,
            type="expense",
            amount=amount,
            category=TRANSFER_CATEGORY,
            description=with_note(f"Transferencia a {to_wallet.name}", note),
            occurred_at=resolved_occurred_at,
            source="transfer",
            transfer_id=transfer_id,
            # Solo la pata de salida lleva la clave: basta para detectar que la transferencia
            # ya se registro, sin duplicarla en cada fila del ledger.
            import_key=seal_import_key(user_id, import_key) if import_key else None,
        )
    )
    db.add(
        Transaction(
            user_id=user_id,
            wallet_id=to_wallet.id,
            type="income",
            amount=credit_amount,
            category=TRANSFER_CATEGORY,
            description=with_note(f"Transferencia desde {from_wallet.name}", note),
            occurred_at=resolved_occurred_at,
            source="transfer",
            transfer_id=transfer_id,
        )
    )
    if fee > 0:
        db.add(
            Transaction(
                user_id=user_id,
                wallet_id=from_wallet.id,
                type="expense",
                amount=fee,
                category=FEE_CATEGORY,
                description=f"Comisión de transferencia a {to_wallet.name}",
                occurred_at=resolved_occurred_at,
                source="manual",
                transfer_id=transfer_id,
            )
        )

    if from_wallet.currency != to_wallet.currency:
        record_transfer_rate_observation(
            db, transfer_id, from_wallet, to_wallet, amount, credit_amount, resolved_occurred_at
        )

    db.commit()
    db.refresh(from_wallet)
    db.refresh(to_wallet)
    return from_wallet, to_wallet
