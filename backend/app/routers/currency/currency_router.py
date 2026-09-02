from decimal import Decimal

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.models.auth.user_model import User
from app.schemas.currency.currency_schemas import ConversionResponse
from app.services.currency.currency_service import convert, get_conversion_rate

router = APIRouter()


@router.get("/convert", response_model=ConversionResponse)
async def convert_endpoint(
    # Sin gt=0 a proposito (bug real encontrado en vivo): esto tambien lo usa
    # BalanceCard.vue para convertir el BALANCE de una wallet a la moneda de
    # visualizacion, y una wallet puede estar perfectamente en negativo (mas
    # gastado que ingresado) - convert()/get_conversion_rate() son una escala
    # lineal, valida para cualquier numero real, asi que exigir positivo
    # estricto aca rechazaba con 422 un caso de uso legitimo.
    amount: Decimal = Query(),
    from_: str = Query(alias="from"),
    to: str = Query(),
    db: Session = Depends(get_db),
    # Requiere solo *un* usuario válido, no dueño de nada en particular en este endpoint.
    current_user: User = Depends(get_current_user),
) -> ConversionResponse:
    from_currency = from_.upper()
    to_currency = to.upper()
    converted_amount = convert(db, amount, from_currency, to_currency)
    rate_used = get_conversion_rate(db, from_currency, to_currency)
    return ConversionResponse(converted_amount=converted_amount, rate_used=rate_used)
