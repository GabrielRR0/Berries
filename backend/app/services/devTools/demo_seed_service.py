"""Semilla de datos falsos para modo demo (ver app.config.Settings.fake_data_mode_active).

Solo para pruebas visuales locales — reutiliza los services reales de cada dominio
(create_wallet/create_transaction/create_debt) en vez de insertar filas a mano, para
que los datos sembrados respeten las mismas invariantes que datos reales (deltas de
saldo aplicados, cuotas generadas correctamente, etc.)."""

import uuid
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.models.auth.user_model import User
from app.services.currency.currency_lookup import get_currency_by_code
from app.services.debts.debt_service import create_debt
from app.services.debts.installment_service import mark_installment_paid
from app.services.transactions.transaction_service import create_transaction
from app.services.wallets.wallet_service import create_wallet

DEMO_EMAIL = "demo@berry.local"


def get_or_create_demo_user(db: Session) -> User:
    existing = db.scalar(select(User).where(User.email == DEMO_EMAIL))
    if existing is not None:
        return existing

    user = User(
        email=DEMO_EMAIL,
        # Password real irrelevante: en modo demo el login nunca la verifica.
        password_hash=hash_password(uuid.uuid4().hex),
        display_name="Usuario Demo",
        default_currency_id=get_currency_by_code(db, "USD").id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    _seed_wallets_and_transactions(db, user)
    _seed_debts(db, user)
    return user


def _months_ago(months: int, day: int) -> datetime:
    today = date.today()
    year = today.year
    month = today.month - months
    while month <= 0:
        month += 12
        year -= 1
    day = min(day, 28)  # evita días inválidos en meses cortos
    return datetime(year, month, day, 12, 0, tzinfo=timezone.utc)


def _seed_wallets_and_transactions(db: Session, user: User) -> None:
    cash = create_wallet(db, user.id, "Efectivo", "USD")
    banco = create_wallet(db, user.id, "Banco de Venezuela", "VEF")
    binance = create_wallet(db, user.id, "Binance", "USDT")

    # (wallet, type, amount, category, description, meses_atras, dia)
    seed_rows: list[tuple] = [
        (cash, "income", Decimal("500.00"), "Ingreso", "Sueldo", 2, 1),
        (cash, "expense", Decimal("120.00"), "Mercado", "Compra del mes", 2, 3),
        (cash, "expense", Decimal("35.50"), "Transporte", "Gasolina", 2, 10),
        (banco, "expense", Decimal("8500.00"), "Servicios", "Luz y agua", 2, 15),
        (binance, "expense", Decimal("15.00"), "Transporte", "Taxi", 2, 20),
        (cash, "income", Decimal("500.00"), "Ingreso", "Sueldo", 1, 1),
        (cash, "expense", Decimal("140.00"), "Mercado", "Compra del mes", 1, 4),
        (binance, "expense", Decimal("20.00"), "Transporte", "Uber", 1, 8),
        (banco, "expense", Decimal("9200.00"), "Servicios", "Internet y luz", 1, 14),
        (cash, "expense", Decimal("60.00"), "Entretenimiento", "Cine", 1, 22),
        (cash, "income", Decimal("500.00"), "Ingreso", "Sueldo", 0, 1),
        (cash, "expense", Decimal("95.00"), "Mercado", "Compra semanal", 0, 3),
        (binance, "income", Decimal("30.00"), "Ingreso", "Venta ocasional", 0, 5),
        (cash, "expense", Decimal("40.00"), "Transporte", "Gasolina", 0, 7),
        (banco, "expense", Decimal("4000.00"), "Servicios", "Internet", 0, 10),
    ]

    for wallet, kind, amount, category, description, months_back, day in seed_rows:
        create_transaction(
            db,
            user.id,
            wallet.id,
            kind,
            amount,
            category,
            description=description,
            occurred_at=_months_ago(months_back, day),
            source="manual",
        )


def _seed_debts(db: Session, user: User) -> None:
    cashea = create_debt(
        db,
        user.id,
        counterparty_name="Cashea",
        direction="owed_by_user",
        total_amount=Decimal("300.00"),
        currency="USD",
        description="Compra a cuotas",
        installment_count=3,
        first_due_date=date.today() - timedelta(days=30),
        frequency_days=30,
    )
    # La primera cuota (la más antigua) queda marcada como ya pagada, para que la
    # pantalla de deudas muestre un mix realista de pagado/pendiente.
    first_installment = min(cashea.installments, key=lambda inst: inst.due_date)
    mark_installment_paid(db, first_installment.id, user.id)

    create_debt(
        db,
        user.id,
        counterparty_name="Juan Pérez",
        direction="owed_to_user",
        total_amount=Decimal("50.00"),
        currency="USD",
        description="Préstamo entre amigos",
    )
