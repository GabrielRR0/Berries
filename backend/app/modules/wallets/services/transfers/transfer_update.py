"""Editar monto, comisión o fecha de una transferencia existente."""

import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy.orm import Session
from sqlalchemy import select

from app.modules.transactions import Transaction
from app.modules.wallets.errors import CurrencyMismatchError, InsufficientBalanceError, TransferNotFoundError
from app.modules.wallets.models.wallet_model import Wallet
from app.modules.wallets.services.transfers.transfer_rates import delete_transfer_rate_observations, record_transfer_rate_observation
from app.modules.wallets.services.wallet_service import get_wallet_owned_by_user
from app.modules.wallets.utils.transfer_labels import FEE_CATEGORY


def update_transfer(
    db: Session,
    user_id: uuid.UUID,
    transfer_id: uuid.UUID,
    amount: Decimal,
    occurred_at: datetime,
    fee: Decimal = Decimal("0"),
    converted_amount: Decimal | None = None,
) -> tuple[Wallet, Wallet]:
    """Edita el monto, la comisión y/o la fecha de una transferencia ya existente -
    pedido explícito del usuario ("que se pueda editar esto [la fecha] y también los
    montos"). A diferencia de update_transaction (que rechaza cualquier fila con
    transfer_id no nulo), esta función SÍ opera sobre las 2-3 filas de una
    transferencia como una unidad completa: revierte el efecto de saldo de las patas
    actuales, valida los montos NUEVOS con la misma regla de moneda/saldo que
    execute_transfer, y actualiza las mismas filas en vez de borrar+crear (conserva
    sus ids). No permite cambiar las billeteras origen/destino - eso sigue
    requiriendo eliminar y recrear la transferencia.

    La comisión puede agregarse, quitarse o modificarse en la misma edición: si antes
    no tenía y ahora `fee` > 0 se crea la fila; si tenía y ahora `fee` es 0 se borra."""
    legs = list(
        db.scalars(
            select(Transaction).where(Transaction.transfer_id == transfer_id, Transaction.user_id == user_id)
        )
    )
    from_leg = next((t for t in legs if t.source == "transfer" and t.type == "expense"), None)
    to_leg = next((t for t in legs if t.source == "transfer" and t.type == "income"), None)
    if from_leg is None or to_leg is None:
        raise TransferNotFoundError("Transferencia no encontrada o no pertenece al usuario")
    fee_leg = next((t for t in legs if t.category == FEE_CATEGORY), None)

    from_wallet = get_wallet_owned_by_user(db, from_leg.wallet_id, user_id)
    to_wallet = get_wallet_owned_by_user(db, to_leg.wallet_id, user_id)

    # Revierte el efecto de saldo de las patas ACTUALES antes de aplicar los montos
    # nuevos - mismo criterio que update_transaction con una wallet individual.
    from_wallet.balance += from_leg.amount + (fee_leg.amount if fee_leg else Decimal("0"))
    to_wallet.balance -= to_leg.amount

    if from_wallet.currency == to_wallet.currency:
        credit_amount = amount  # converted_amount se ignora deliberadamente en este caso
    else:
        if converted_amount is None:
            raise CurrencyMismatchError(
                "converted_amount es requerido cuando las billeteras tienen monedas distintas"
            )
        credit_amount = converted_amount

    total_debit = amount + fee
    if from_wallet.balance < total_debit:
        raise InsufficientBalanceError("Saldo insuficiente para esta transferencia")

    from_wallet.balance -= total_debit
    to_wallet.balance += credit_amount

    from_leg.amount = amount
    from_leg.occurred_at = occurred_at
    to_leg.amount = credit_amount
    to_leg.occurred_at = occurred_at

    if fee > 0:
        if fee_leg is not None:
            fee_leg.amount = fee
            fee_leg.occurred_at = occurred_at
        else:
            db.add(
                Transaction(
                    user_id=user_id,
                    wallet_id=from_wallet.id,
                    type="expense",
                    amount=fee,
                    category=FEE_CATEGORY,
                    description=f"Comisión de transferencia a {to_wallet.name}",
                    occurred_at=occurred_at,
                    source="manual",
                    transfer_id=transfer_id,
                )
            )
    elif fee_leg is not None:
        db.delete(fee_leg)

    if from_wallet.currency != to_wallet.currency:
        # Reemplaza la observación vieja por la corregida en vez de acumular una
        # nueva cada vez que se edita el monto - las wallets (y por lo tanto el par
        # de monedas) no se pueden cambiar acá, así que si existía una observación
        # antes, sigue existiendo con el mismo par, solo cambia la tasa/fecha.
        delete_transfer_rate_observations(db, transfer_id)
        record_transfer_rate_observation(db, transfer_id, from_wallet, to_wallet, amount, credit_amount, occurred_at)

    db.commit()
    db.refresh(from_wallet)
    db.refresh(to_wallet)
    return from_wallet, to_wallet
