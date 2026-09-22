"""CLI de administración del backend, con nombres de comando inspirados en Laravel
artisan / Django manage.py — pero es 100% Alembic/SQLAlchemy por debajo, no un
framework de migraciones propio. Correr siempre desde `berry/backend/` con el venv
activado.

Comandos:
    python manage.py migrate                 # alembic upgrade head
    python manage.py migrate:rollback         # alembic downgrade -1
    python manage.py make:migration "mensaje" # alembic revision --autogenerate -m "mensaje"
    python manage.py seed:demo [--reset]      # crea/reseedea el usuario demo con datos falsos
    python manage.py backfill:reference-amounts [--dry-run]  # rellena/reconcilia currency_id,
        # reference_amount_usd y reference_rate de transactions viejas - puede MODIFICAR valores ya
        # existentes (no solo NULLs), ver backfill_reference_amounts en transaction_service.py.
        # --dry-run hace el mismo trabajo pero termina en rollback, para revisar el reporte de
        # cambios antes de tocar datos reales (recomendado correrlo así primero, contra una copia).
    python manage.py backfill:vef-rate-history [--months N]  # trae el histórico REAL de la
        # tasa oficial (BCV) de los últimos N meses (12 por default) vía dolarapi.com e inserta
        # los días que todavía no existan en ExchangeRate - idempotente, ver
        # backfill_historical_vef_rates en currency_service.py.
"""

import argparse
import subprocess
import sys


def cmd_migrate(_args: argparse.Namespace) -> None:
    subprocess.run([sys.executable, "-m", "alembic", "upgrade", "head"], check=True)


def cmd_migrate_rollback(_args: argparse.Namespace) -> None:
    subprocess.run([sys.executable, "-m", "alembic", "downgrade", "-1"], check=True)


def cmd_make_migration(args: argparse.Namespace) -> None:
    subprocess.run(
        [sys.executable, "-m", "alembic", "revision", "--autogenerate", "-m", args.message], check=True
    )


def _delete_demo_user_data(db, user) -> None:
    """Borra en el orden correcto para no pisar foreign keys: `cascade="all,
    delete-orphan"` de Debt.installments solo aplica a borrados objeto-por-objeto vía
    la sesión ORM (`db.delete(obj)`), no a un DELETE masivo — por eso acá se borra cada
    fila explícitamente en vez de un solo `delete(User)...`."""
    from app.models.debts.debt_model import Debt
    from app.models.transactions.transaction_draft_model import TransactionDraft
    from app.models.transactions.transaction_model import Transaction
    from app.models.wallets.wallet_model import Wallet

    for model in (Transaction, TransactionDraft):
        for row in db.query(model).filter(model.user_id == user.id):
            db.delete(row)

    for debt in db.query(Debt).filter(Debt.user_id == user.id):
        db.delete(debt)  # cascade="all, delete-orphan" sí aplica acá: borra sus installments

    for wallet in db.query(Wallet).filter(Wallet.user_id == user.id):
        db.delete(wallet)

    db.delete(user)
    db.commit()


def cmd_seed_demo(args: argparse.Namespace) -> None:
    # Imports adentro de la función: manage.py no debe pagar el costo de importar toda
    # la app (ni requerir DATABASE_URL/JWT_SECRET) para comandos que no lo necesitan.
    from app.core.database import SessionLocal
    from app.models.auth.user_model import User
    from app.services.devTools.demo_seed_service import DEMO_EMAIL, get_or_create_demo_user

    db = SessionLocal()
    try:
        if args.reset:
            existing = db.query(User).filter(User.email == DEMO_EMAIL).one_or_none()
            if existing is not None:
                _delete_demo_user_data(db, existing)
                print(f"Usuario demo previo ({DEMO_EMAIL}) y sus datos sembrados fueron borrados.")

        user = get_or_create_demo_user(db)
        print(f"Usuario demo listo: {user.email} (id={user.id})")
    finally:
        db.close()


def cmd_backfill_reference_amounts(args: argparse.Namespace) -> None:
    # Pedido explícito del usuario, con captura real: en Movimientos vio transactions
    # viejas en VEF (creadas antes de que reference_amount_usd existiera) sin ningún
    # valor de referencia. Corre sobre TODO el sistema (no un usuario en particular) -
    # ver backfill_reference_amounts en transaction_service.py, que ahora también
    # reconcilia (no solo rellena) valores ya existentes que quedaron mal calculados
    # por el fallback roto de get_rate_at, corregido en esta misma tanda de cambios.
    from app.core.database import SessionLocal
    from app.services.transactions.transaction_service import backfill_reference_amounts

    db = SessionLocal()
    try:
        report = backfill_reference_amounts(db, dry_run=args.dry_run)
        mode = "[DRY RUN, nada se guardó] " if args.dry_run else ""
        print(f"{mode}{report['currency_id_filled']} transacciones con currency_id rellenado.")
        print(f"{mode}{report['reference_filled']} transacciones con reference_amount_usd/reference_rate rellenado (antes NULL).")
        print(f"{mode}{report['reference_reconciled']} transacciones con reference_amount_usd/reference_rate CORREGIDO (valor previo distinto).")
        for change in report["changes"]:
            print(
                f"  - transaction {change['transaction_id']} (usuario {change['user_id']}, {change['currency']}): "
                f"{change['old_reference_amount_usd']} -> {change['new_reference_amount_usd']} USD"
            )
    finally:
        db.close()


def cmd_backfill_vef_rate_history(args: argparse.Namespace) -> None:
    # Pedido explícito del usuario: "buscar registros anteriores... de hace un año
    # para acá" - dolarapi.com ya tiene el histórico real completo, solo hacía falta
    # traerlo. Ver backfill_historical_vef_rates en currency_service.py.
    from app.core.database import SessionLocal
    from app.services.currency.currency_service import backfill_historical_vef_rates

    db = SessionLocal()
    try:
        inserted = backfill_historical_vef_rates(db, months=args.months)
        print(f"{inserted} días nuevos de historial VEF/USD agregados (últimos {args.months} meses).")
    finally:
        db.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Comandos de administración del backend de Berry")
    subparsers = parser.add_subparsers(dest="command", required=True)

    subparsers.add_parser("migrate", help="Corre todas las migraciones pendientes").set_defaults(func=cmd_migrate)
    subparsers.add_parser("migrate:rollback", help="Revierte la última migración").set_defaults(
        func=cmd_migrate_rollback
    )

    make_migration = subparsers.add_parser("make:migration", help="Genera una nueva migración autogenerada")
    make_migration.add_argument("message", help="Descripción corta de la migración")
    make_migration.set_defaults(func=cmd_make_migration)

    seed_demo = subparsers.add_parser("seed:demo", help="Crea (o reseedea) el usuario demo con datos falsos")
    seed_demo.add_argument("--reset", action="store_true", help="Borra el usuario demo existente antes de crearlo")
    seed_demo.set_defaults(func=cmd_seed_demo)

    backfill_reference_amounts = subparsers.add_parser(
        "backfill:reference-amounts",
        help="Rellena/reconcilia currency_id, reference_amount_usd y reference_rate de transactions viejas "
        "(puede modificar valores ya existentes, no solo NULLs)",
    )
    backfill_reference_amounts.add_argument(
        "--dry-run", action="store_true", help="Solo reporta los cambios, no los guarda (rollback al final)"
    )
    backfill_reference_amounts.set_defaults(func=cmd_backfill_reference_amounts)

    backfill_vef_rate_history = subparsers.add_parser(
        "backfill:vef-rate-history",
        help="Trae el histórico real de la tasa oficial (BCV) vía dolarapi.com e inserta los días que falten",
    )
    backfill_vef_rate_history.add_argument(
        "--months", type=int, default=12, help="Cuántos meses hacia atrás traer (default 12)"
    )
    backfill_vef_rate_history.set_defaults(func=cmd_backfill_vef_rate_history)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
