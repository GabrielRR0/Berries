from app.common.security import cron_group
from app.database import DbSession
from app.modules.currency import services
from app.modules.currency.contracts.resources import RefreshDailyResource

router = cron_group()


@router.get("/refresh-daily", response_model=RefreshDailyResource)
async def refresh_daily(db: DbSession) -> RefreshDailyResource:
    """Vercel Cron le pega a esto una vez al día (ver vercel.json) para que las tasas de
    cambio se refresquen aunque nadie visite la app ese día - pedido explícito del
    usuario ("una vez al día... si nadie entró un día se actualiza"). Vercel Cron
    siempre invoca por GET, nunca por POST."""
    return RefreshDailyResource(refreshed_currencies=services.refresh_all_active_currencies(db))
