import uuid
from datetime import date, datetime, timezone
from decimal import Decimal

from sqlalchemy.orm import Session

from app.models.debts.debt_payment_model import DebtPayment
from app.models.transactions.transaction_model import Transaction
from app.models.wallets.wallet_model import Wallet
from app.services.currency.currency_lookup import get_currency_by_code
from app.services.currency.pegged_currencies import currencies_are_equivalent
from app.services.debts.debt_service import get_debt_owned_by_user
from app.services.debts.errors import DebtNotFoundError, DebtValidationError
from app.services.wallets.errors import CurrencyMismatchError, InsufficientBalanceError
from app.services.wallets.wallet_service import get_wallet_owned_by_user

# Categorías fijas (no vienen del catálogo de Category - ver transfer_service.py y sus
# propias TRANSFER_CATEGORY/FEE_CATEGORY, mismo criterio: una etiqueta libre en texto,
# no una fila de la tabla categories).
DEBT_INCOME_CATEGORY = "Cobro de deuda"
DEBT_EXPENSE_CATEGORY = "Pago de deuda"


def create_debt_payment(
    db: Session,
    debt_id: uuid.UUID,
    user_id: uuid.UUID,
    amount: Decimal | float | str,
    currency: str,
    applied_amount: Decimal | float | str | None = None,
    note: str | None = None,
    paid_at: date | None = None,
    wallet_id: uuid.UUID | None = None,
) -> DebtPayment:
    """Registra un abono/cobro parcial contra una deuda (ver DebtPayment). A
    diferencia de las cuotas (Installment, monto fijo definido al crear la deuda),
    esto acepta cualquier monto en cualquier momento - "Steven me pagó 50 USDT",
    pedido explícito del usuario.

    `wallet_id` es opcional: si se manda, además de quedar en el historial, el pago
    se refleja en una billetera real - "sería como un ingreso/gasto de una deuda"
    (pedido explícito). La billetera tiene que estar en la MISMA moneda que `amount`
    (no la de la deuda) - se deposita/retira exactamente lo que pasó, sin convertir."""
    debt = get_debt_owned_by_user(db, debt_id, user_id)

    amount = Decimal(str(amount))
    if amount <= 0:
        raise DebtValidationError("amount debe ser mayor a 0")

    currency_row = get_currency_by_code(db, currency)

    if currencies_are_equivalent(currency_row.code, debt.currency):
        # Misma moneda, o el par USD/USDT (atado 1:1) - el equivalente aplicado es el
        # mismo monto, sin pedirle al usuario que lo vuelva a escribir (sigue
        # aceptando un applied_amount manual si lo manda, por si alguna vez hace
        # falta ajustarlo a mano).
        resolved_applied_amount = Decimal(str(applied_amount)) if applied_amount is not None else amount
    else:
        if applied_amount is None:
            raise DebtValidationError(
                "applied_amount es requerido cuando el pago está en una moneda distinta a la de la deuda"
            )
        resolved_applied_amount = Decimal(str(applied_amount))

    if resolved_applied_amount <= 0:
        raise DebtValidationError("applied_amount debe ser mayor a 0")

    resolved_paid_at = paid_at or date.today()

    transaction_id: uuid.UUID | None = None
    if wallet_id is not None:
        wallet = get_wallet_owned_by_user(db, wallet_id, user_id)
        if wallet.currency != currency_row.code:
            raise CurrencyMismatchError("La billetera elegida no es de la misma moneda que el pago")

        occurred_at = datetime.combine(resolved_paid_at, datetime.min.time()).replace(tzinfo=timezone.utc)
        if debt.direction == "owed_to_user":
            # Le pagan al usuario: entra plata real a la billetera - cuenta como
            # ingreso real en Análisis (source="debt_payment" no está en la lista de
            # exclusiones de analytics_service, a propósito: a diferencia de una
            # transferencia entre wallets propias, esto SÍ es plata nueva).
            wallet.balance += amount
            transaction = Transaction(
                user_id=user_id,
                wallet_id=wallet.id,
                type="income",
                amount=amount,
                category=DEBT_INCOME_CATEGORY,
                description=f"Cobro de deuda - {debt.counterparty_name}",
                occurred_at=occurred_at,
                source="debt_payment",
            )
        else:
            # El usuario paga su propia deuda: sale plata real de la billetera.
            if wallet.balance < amount:
                raise InsufficientBalanceError("Saldo insuficiente en la billetera elegida")
            wallet.balance -= amount
            transaction = Transaction(
                user_id=user_id,
                wallet_id=wallet.id,
                type="expense",
                amount=amount,
                category=DEBT_EXPENSE_CATEGORY,
                description=f"Pago de deuda - {debt.counterparty_name}",
                occurred_at=occurred_at,
                source="debt_payment",
            )
        db.add(transaction)
        db.flush()  # asigna transaction.id sin cerrar la transacción
        transaction_id = transaction.id

    payment = DebtPayment(
        debt_id=debt.id,
        amount=amount,
        currency_id=currency_row.id,
        applied_amount=resolved_applied_amount,
        note=note,
        paid_at=resolved_paid_at,
        wallet_id=wallet_id,
        transaction_id=transaction_id,
    )
    db.add(payment)
    db.commit()
    db.refresh(payment)
    return payment


def delete_debt_payment(db: Session, debt_id: uuid.UUID, payment_id: uuid.UUID, user_id: uuid.UUID) -> None:
    """Si el pago había acreditado/debitado una billetera real, revierte ese delta y
    borra la Transaction asociada antes de borrar el pago - mismo criterio que
    transaction_service.delete_transaction (nunca dejar el ledger inconsistente)."""
    debt = get_debt_owned_by_user(db, debt_id, user_id)
    payment = db.get(DebtPayment, payment_id)
    if payment is None or payment.debt_id != debt.id:
        raise DebtNotFoundError("Pago no encontrado")

    if payment.wallet_id is not None:
        wallet = db.get(Wallet, payment.wallet_id)
        if wallet is not None:
            if debt.direction == "owed_to_user":
                wallet.balance -= payment.amount
            else:
                wallet.balance += payment.amount

    # DebtPayment.transaction_id apunta a esta Transaction (FK) - hay que borrar el
    # pago PRIMERO (flush incluido) para que esa fila deje de referenciarla antes de
    # borrar la Transaction; en el orden contrario, Postgres rechaza el DELETE de
    # transactions con una violación de FK (bug real encontrado probando en vivo).
    transaction_id = payment.transaction_id
    db.delete(payment)
    db.flush()

    if transaction_id is not None:
        transaction = db.get(Transaction, transaction_id)
        if transaction is not None:
            db.delete(transaction)

    db.commit()
