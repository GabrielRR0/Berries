"""`python manage.py backfill:reference-amounts [--dry-run]`

Pedido explícito del usuario, con captura real: en Movimientos vio transactions viejas
en VEF (creadas antes de que reference_amount_usd existiera) sin ningún valor de
referencia. Corre sobre TODO el sistema (no un usuario en particular) - ver
backfill_reference_amounts en services/ledger/reference_backfill.py, que también
reconcilia (no solo rellena) valores ya existentes que quedaron mal calculados por el
fallback roto de get_rate_at.
"""

from app.database import SessionLocal
from app.modules.transactions.services import backfill_reference_amounts


def run(dry_run: bool) -> None:
    db = SessionLocal()
    try:
        report = backfill_reference_amounts(db, dry_run=dry_run)
        mode = "[DRY RUN, nada se guardó] " if dry_run else ""
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
