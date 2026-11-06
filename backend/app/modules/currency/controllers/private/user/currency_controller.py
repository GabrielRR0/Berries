from decimal import Decimal

from fastapi import Query

from app.common.security import auth_group
from app.database import DbSession
from app.modules.currency import services
from app.modules.currency.contracts.resources import ConversionResource, RateHistoryResource

# Requiere solo *un* usuario válido, no dueño de nada en particular.
router = auth_group()


@router.get("/convert", response_model=ConversionResource)
async def convert_endpoint(
    db: DbSession,
    # Sin gt=0 a proposito (bug real encontrado en vivo): esto tambien lo usa
    # BalanceCard.vue para convertir el BALANCE de una wallet a la moneda de
    # visualizacion, y una wallet puede estar perfectamente en negativo (mas
    # gastado que ingresado) - convert()/get_conversion_rate() son una escala
    # lineal, valida para cualquier numero real, asi que exigir positivo
    # estricto aca rechazaba con 422 un caso de uso legitimo.
    amount: Decimal = Query(),
    from_: str = Query(alias="from"),
    to: str = Query(),
) -> ConversionResource:
    return services.build_conversion(db, amount, from_, to)


@router.get("/history", response_model=RateHistoryResource)
async def history(
    db: DbSession,
    code: str = Query(),
    months: int = Query(default=6, ge=1, le=24),
    # "against" default USD = la serie oficial/de mercado. "USDT" trae en cambio la
    # serie de tasas implícitas reales del propio usuario (ver
    # app/modules/wallets/services/transfers/transfer_rates.py) - pedido explícito del
    # usuario: comparar la tasa oficial contra la que él de verdad consigue.
    against: str = Query(default="USD"),
) -> RateHistoryResource:
    return services.build_rate_history(db, code, months, against)
