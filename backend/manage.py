"""CLI de administración del backend, con nombres de comando inspirados en Laravel
artisan / Django manage.py — pero es 100% Alembic/SQLAlchemy por debajo, no un
framework de migraciones propio. Correr siempre desde `berry/backend/` con el venv
activado.

Cada comando de datos vive en el módulo al que pertenece (`app/modules/<modulo>/commands/`)
y este archivo solo lo despacha.

Comandos:
    python manage.py migrate                 # alembic upgrade head
    python manage.py migrate:rollback         # alembic downgrade -1
    python manage.py make:migration "mensaje" # alembic revision --autogenerate -m "mensaje"
    python manage.py seed:demo [--reset]      # crea/reseedea el usuario demo con datos falsos
    python manage.py backfill:reference-amounts [--dry-run]  # rellena/reconcilia currency_id,
        # reference_amount_usd y reference_rate de transactions viejas - puede MODIFICAR valores ya
        # existentes (no solo NULLs), ver app/modules/transactions/commands/.
        # --dry-run hace el mismo trabajo pero termina en rollback, para revisar el reporte de
        # cambios antes de tocar datos reales (recomendado correrlo así primero, contra una copia).
    python manage.py check:rates [--tolerance 0.10]  # SOLO LECTURA: compara las tasas del bolivar guardadas y
        # el valor de referencia congelado en los movimientos contra la serie real del proveedor y lista lo que
        # se aparte mas de la tolerancia (10 % por defecto). Sale con codigo 1 si encuentra algo. Ver
        # app/modules/currency/commands/check_rates.py.
    python manage.py backfill:vef-rate-history [--months N]  # trae el histórico REAL de la
        # tasa oficial (BCV) de los últimos N meses (12 por default) vía dolarapi.com e inserta
        # los días que todavía no existan en ExchangeRate - idempotente, ver
        # app/modules/currency/commands/.
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


def cmd_seed_demo(args: argparse.Namespace) -> None:
    # Imports adentro de cada comando: manage.py no debe pagar el costo de importar toda
    # la app (ni requerir DATABASE_URL/JWT_SECRET) para comandos que no lo necesitan.
    from app.modules.dev_tools import seed_demo_command

    seed_demo_command(reset=args.reset)


def cmd_backfill_reference_amounts(args: argparse.Namespace) -> None:
    from app.modules.transactions import backfill_reference_amounts_command

    backfill_reference_amounts_command(dry_run=args.dry_run)


def cmd_backfill_vef_rate_history(args: argparse.Namespace) -> None:
    from app.modules.currency import backfill_vef_rate_history_command

    backfill_vef_rate_history_command(months=args.months)


def cmd_check_rates(args: argparse.Namespace) -> None:
    from app.modules.currency import check_rates_command

    sys.exit(check_rates_command(tolerance=args.tolerance))


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

    check_rates = subparsers.add_parser(
        "check:rates",
        help="Solo lectura: lista las tasas del bolivar y los valores de referencia que se aparten de la serie real",
    )
    check_rates.add_argument("--tolerance", type=float, default=0.10, help="Desvio permitido (default 0.10 = 10 %%)")
    check_rates.set_defaults(func=cmd_check_rates)

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
