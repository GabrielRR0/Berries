from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.common.security import verify_cron_secret
from app.database import get_db
from app.modules.currency.contracts.resources import RefreshDailyResource
from app.modules.currency.services.currency_service import refresh_all_active_currencies

router = APIRouter()


@router.get("/refresh-daily", response_model=RefreshDailyResource, dependencies=[Depends(verify_cron_secret)])
async def refresh_daily(db: Session = Depends(get_db)) -> RefreshDailyResource:
    """Vercel Cron le pega a esto una vez al día (ver vercel.json) para que las tasas de
    cambio se refresquen aunque nadie visite la app ese día - pedido explícito del
    usuario ("una vez al día... si nadie entró un día se actualiza"). Vercel Cron
    siempre invoca por GET, nunca por POST."""
    refreshed = refresh_all_active_currencies(db)
    return RefreshDailyResource(refreshed_currencies=refreshed)
