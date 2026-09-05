import uuid
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.goals.goal_check_in_model import GoalCheckIn
from app.models.goals.goal_model import Goal
from app.models.wallets.wallet_model import Wallet
from app.services.goals.errors import InsufficientAvailableBalanceError
from app.services.wallets.errors import CurrencyMismatchError
from app.services.wallets.wallet_service import get_wallet_owned_by_user

# Modulo separado de goal_service.py/check_in_service.py (que ya se importan entre si)
# para que ambos puedan llamar a esto sin import circular.


def get_committed_amounts_for_user(db: Session, user_id: uuid.UUID) -> dict[uuid.UUID, Decimal]:
    """Cuanto de cada billetera ya esta "comprometido" (enlazado) en aportes de metas
    ACTIVAS del usuario - pedido explicito del usuario: mostrar, ademas del saldo real
    de siempre, un "disponible" que descuenta esto. amount_saved es EncryptedDecimal
    (Fernet con IV aleatorio) - NUNCA se puede sumar por SQL (mismo motivo que
    analytics_service.py/transaction_service.py), asi que se traen las filas y se suma
    en Python. Solo metas activas cuentan: completar/abandonar una meta libera su
    reserva (mismo criterio que goal_service.get_goal_summary, que ya solo suma metas
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
    dueño, misma moneda (pedido explicito del usuario: sin conversion en esta pasada,
    solo billeteras de la moneda de la meta) y saldo DISPONIBLE suficiente (no el
    saldo total - ya puede estar parcialmente comprometido en otras metas)."""
    wallet = get_wallet_owned_by_user(db, wallet_id, user_id)
    if wallet.currency != currency:
        raise CurrencyMismatchError("La billetera elegida no es de la misma moneda que la meta")
    available = get_available_balance(db, user_id, wallet, exclude_check_in_id=exclude_check_in_id)
    if amount > available:
        raise InsufficientAvailableBalanceError(
            "La billetera elegida no tiene saldo disponible suficiente para este aporte"
        )
    return wallet
