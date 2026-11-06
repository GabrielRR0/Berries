"""`python manage.py check:rates [--tolerance 0.10]` (solo lectura). Ver audit_vef_rates en
services/history/vef_rate_audit.py."""

from decimal import Decimal

from app.database import SessionLocal
from app.modules.currency.services import audit_vef_rates


def run(tolerance: float) -> int:
    """Devuelve el código de salida: 1 si encontró algo que se aparta de la serie real."""
    db = SessionLocal()
    try:
        audit = audit_vef_rates(db, tolerance=Decimal(str(tolerance)))
    finally:
        db.close()

    print(f"Filas de tasa que se apartan de la real: {len(audit.bad_rates)}")
    for item in audit.bad_rates:
        print(f"  - {item['id']} {item['fetched_at']}: {item['bs_per_usd']} Bs/USD (publicada {item['published']}), fuente {item['source']}")
    print(f"Movimientos con un valor de referencia que se aparta de la real: {len(audit.affected_transactions)}")
    for item in audit.affected_transactions:
        print(f"  - {item['id']} {item['occurred_on']}: tasa guardada {item['stored_rate']} (publicada {item['published']})")
    if not audit.is_clean:
        print("Reparacion: borrar la fila de tasa mala y correr `python manage.py backfill:reference-amounts`.")
        return 1
    print("Todo en orden.")
    return 0
