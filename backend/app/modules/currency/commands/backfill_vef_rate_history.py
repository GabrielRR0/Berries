"""`python manage.py backfill:vef-rate-history [--months N]`

Pedido explícito del usuario: "buscar registros anteriores... de hace un año para acá" -
dolarapi.com ya tiene el histórico real completo, solo hacía falta traerlo. Ver
backfill_historical_vef_rates en services/history/vef_history.py.
"""

from app.database import SessionLocal
from app.modules.currency.services import backfill_historical_vef_rates


def run(months: int) -> None:
    db = SessionLocal()
    try:
        inserted = backfill_historical_vef_rates(db, months=months)
        print(f"{inserted} días nuevos de historial VEF/USD agregados (últimos {months} meses).")
    finally:
        db.close()
