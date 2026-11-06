"""Cuánto de cada billetera está apartado para metas activas, y el saldo disponible."""

import uuid
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.currency import currencies_are_equivalent
from app.modules.goals.contracts.resources import WalletCommitmentResource
from app.modules.goals.errors import InsufficientAvailableBalanceError
from app.modules.goals.models.goal_check_in_model import GoalCheckIn
from app.modules.goals.models.goal_model import Goal
from app.modules.wallets import CurrencyMismatchError
from app.modules.wallets import Wallet
from app.modules.wallets import get_wallet_owned_by_user


def get_committed_amounts_for_user(db: Session, user_id: uuid.UUID) -> dict[uuid.UUID, Decimal]:
    """Cuanto de cada billetera ya esta "comprometido" (enlazado) en aportes de metas
    ACTIVAS del usuario - pedido explicito del usuario: mostrar, ademas del saldo real
    de siempre, un "disponible" que descuenta esto. amount_saved es EncryptedDecimal
    (Fernet con IV aleatorio) - NUNCA se puede sumar por SQL (mismo motivo que
    analytics/services/ y transactions/services/ledger/), asi que se traen las filas y se suma
    en Python. Solo metas activas cuentan: completar/abandonar una meta libera su
    reserva (mismo criterio que goals/services/management.get_goal_summary, que ya solo suma metas
    activas)."""
    stmt = (
        select(GoalCheckIn)
        .join(Goal, Goal.id == GoalCheckIn.goal_id)
        .where(Goal.user_id == user_id)
        .where(Goal.status == "active")
        .where(GoalCheckIn.wallet_id.isnot(None))
    )
    committed: dict[uuid.UUID, Decimal] = {}
    for check_in in db.scalars(stmt).all():
        committed[check_in.wallet_id] = committed.get(check_in.wallet_id, Decimal("0")) + check_in.amount_saved
    return committed


def get_available_balance(
    db: Session, user_id: uuid.UUID, wallet: Wallet, exclude_check_in_id: uuid.UUID | None = None
) -> Decimal:
    """Saldo real menos lo ya comprometido en otros aportes. exclude_check_in_id resta
    el propio aporte que se esta editando - sin esto, reconfirmar/re-enlazar la MISMA
    billetera en una edicion se rechazaria a si misma (su propio monto ya cuenta como
    "comprometido" antes de aplicar el cambio)."""
    committed = get_committed_amounts_for_user(db, user_id).get(wallet.id, Decimal("0"))
    if exclude_check_in_id is not None:
        excluded = db.get(GoalCheckIn, exclude_check_in_id)
        if excluded is not None and excluded.wallet_id == wallet.id:
            committed -= excluded.amount_saved
    return wallet.balance - committed


def validate_and_get_wallet_for_commitment(
    db: Session,
    user_id: uuid.UUID,
    wallet_id: uuid.UUID,
    currency: str,
    amount: Decimal,
    exclude_check_in_id: uuid.UUID | None = None,
) -> Wallet:
    """Valida que `wallet_id` pueda respaldar un aporte de `amount` en `currency`:
    dueño, misma moneda o par USD/USDT (pedido explicito del usuario: "si es dolares,
    acepte dolares y usdt", mismo criterio ya establecido en debt_payment_service.py -
    sin conversion real para el resto de los pares, floating currencies como
    EUR/VEF/COP/ARS si necesitan coincidir exacto) y saldo DISPONIBLE suficiente (no
    el saldo total - ya puede estar parcialmente comprometido en otras metas)."""
    wallet = get_wallet_owned_by_user(db, wallet_id, user_id)
    if not currencies_are_equivalent(wallet.currency, currency):
        raise CurrencyMismatchError("La billetera elegida no es de la misma moneda que la meta")
    available = get_available_balance(db, user_id, wallet, exclude_check_in_id=exclude_check_in_id)
    if amount > available:
        raise InsufficientAvailableBalanceError(
            "La billetera elegida no tiene saldo disponible suficiente para este aporte"
        )
    return wallet


def list_wallet_commitments(db: Session, user_id: uuid.UUID) -> list[WalletCommitmentResource]:
    """Lo que devuelve GET /goals/wallet-commitments: cuánto de cada billetera está
    apartado para metas."""
    return [
        WalletCommitmentResource(wallet_id=wallet_id, committed_amount=amount)
        for wallet_id, amount in get_committed_amounts_for_user(db, user_id).items()
    ]
