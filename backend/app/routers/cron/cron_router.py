from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deps import get_db, verify_cron_secret
from app.schemas.currency.currency_schemas import RefreshDailyResponse
from app.services.currency.currency_service import refresh_all_active_currencies

router = APIRouter()


@router.get("/refresh-daily", response_model=RefreshDailyResponse, dependencies=[Depends(verify_cron_secret)])
async def refresh_daily(db: Session = Depends(get_db)) -> RefreshDailyResponse:
    """Vercel Cron le pega a esto una vez al día (ver vercel.json) para que las tasas de
    cambio se refresquen aunque nadie visite la app ese día - pedido explícito del
    usuario ("una vez al día... si nadie entró un día se actualiza"). Vercel Cron
    siempre invoca por GET, nunca por POST."""
    refreshed = refresh_all_active_currencies(db)
    return RefreshDailyResponse(refreshed_currencies=refreshed)
