import uuid
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy.orm import Session

from sqlalchemy import select

from app.models.currency.exchange_rate_model import ExchangeRate
from app.models.transactions.transaction_model import Transaction
from app.models.wallets.wallet_model import Wallet
from app.services.wallets.errors import CurrencyMismatchError, InsufficientBalanceError, TransferNotFoundError
from app.services.wallets.wallet_service import get_wallet_owned_by_user

TRANSFER_CATEGORY = "Transferencia"
FEE_CATEGORY = "Comisión"
TRANSFER_RATE_SOURCE = "user-transfer"


def _record_transfer_rate_observation(
    db: Session,
    transfer_id: uuid.UUID,
    from_wallet: Wallet,
    to_wallet: Wallet,
    amount: Decimal,
    credit_amount: Decimal,
    occurred_at: datetime,
) -> None:
    """Congela la tasa IMPLÍCITA real de una transferencia entre monedas distintas
    (ej. cuántos bolívares dieron por USDT ese día/hora) - pedido explícito del
    usuario: "quiero que se guarden este tipo de registros adicionales para
    análisis, de cuánto estaba aprox el usdt ese día y a esa hora". No es una tasa
    de mercado genérica (BCV, Open Exchange Rates...) sino la que el usuario
    obtuvo DE VERDAD en esa operación puntual - más real que cualquier fetch de
    API, así que se guarda con is_estimated=False.

    Usa la MISMA tabla ExchangeRate (ya es un log histórico append-only) en vez de
    una tabla nueva - el par (from.currency, to.currency) es distinto del par que
    usa la tasa oficial (ej. USD/VEF), así que nunca se mezclan ni se pisan entre
    sí. Guarda ambas direcciones, mismo criterio que refresh_all_active_currencies
    en currency_service.py. rate = "cuántas unidades de quote equivalen a 1 de
    base" (misma convención que el resto de ExchangeRate).

    transfer_id vincula esta fila con la transferencia que la generó - permite que
    update_transfer la corrija en vez de acumular una nueva cada vez que se edita
    un monto, y que delete_transaction la borre junto con el resto."""
    if amount == 0:
        return
    db.add(
        ExchangeRate(
            base_currency_id=from_wallet.currency_id,
            quote_currency_id=to_wallet.currency_id,
            rate=credit_amount / amount,
            fetched_at=occurred_at,
            source=TRANSFER_RATE_SOURCE,
            is_estimated=False,
            transfer_id=transfer_id,
        )
    )
    if credit_amount != 0:
        db.add(
            ExchangeRate(
                base_currency_id=to_wallet.currency_id,
                quote_currency_id=from_wallet.currency_id,
                rate=amount / credit_amount,
                fetched_at=occurred_at,
                source=TRANSFER_RATE_SOURCE,
                is_estimated=False,
                transfer_id=transfer_id,
            )
        )


def _delete_transfer_rate_observations(db: Session, transfer_id: uuid.UUID) -> None:
    for row in db.scalars(select(ExchangeRate).where(ExchangeRate.transfer_id == transfer_id)):
        db.delete(row)


def execute_transfer(
    db: Session,
    user_id: uuid.UUID,
    from_wallet_id: uuid.UUID,
    to_wallet_id: uuid.UUID,
    amount: Decimal,
    fee: Decimal = Decimal("0"),
    converted_amount: Decimal | None = None,
    occurred_at: datetime | None = None,
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
    Analisis/Metas (ver analytics_service, que excluye source="transfer") y verse en
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
            description=f"Transferencia a {to_wallet.name}",
            occurred_at=resolved_occurred_at,
            source="transfer",
            transfer_id=transfer_id,
        )
    )
    db.add(
        Transaction(
            user_id=user_id,
            wallet_id=to_wallet.id,
            type="income",
            amount=credit_amount,
            category=TRANSFER_CATEGORY,
            description=f"Transferencia desde {from_wallet.name}",
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
        _record_transfer_rate_observation(
            db, transfer_id, from_wallet, to_wallet, amount, credit_amount, resolved_occurred_at
        )

    db.commit()
    db.refresh(from_wallet)
    db.refresh(to_wallet)
    return from_wallet, to_wallet


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
        _delete_transfer_rate_observations(db, transfer_id)
        _record_transfer_rate_observation(db, transfer_id, from_wallet, to_wallet, amount, credit_amount, occurred_at)

    db.commit()
    db.refresh(from_wallet)
    db.refresh(to_wallet)
    return from_wallet, to_wallet
