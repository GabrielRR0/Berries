"""Conversión de moneda. Regla de diseño (no negociable, ver plan de arreglo de sumas):
Berry sigue el mismo criterio que IAS 21/ASC 830 para partidas monetarias vs. no
monetarias en moneda extranjera - un saldo/balance ("partida monetaria", existe HOY)
SIEMPRE se retraduce a la tasa vigente en el momento de mirarlo (convert/
get_conversion_rate, más abajo); una transacción ya ocurrida ("partida histórica", un
hecho del pasado) NUNCA se retraduce - se congela para siempre a la tasa vigente el día
en que pasó (convert_at/get_conversion_rate_at/reference_fields_in_usd). Nadie debe
"simplificar" esto para que todo use la misma tasa - son dos preguntas distintas
("¿cuánto vale esto ahora?" vs. "¿cuánto valía esto esa vez?") con respuestas que
deliberadamente no coinciden para una moneda con inflación fuerte (VEF, COP, ARS)."""

from datetime import datetime
from decimal import Decimal

from sqlalchemy.orm import Session

from app.modules.currency.contracts.resources import ConversionResource
from app.modules.currency.services.history.vef_history import ensure_vef_history_covers
from app.modules.currency.services.rates.cache_refresh import get_fresh_rate, get_rate_at


def _rate_to_usd(db: Session, currency: str) -> Decimal:
    if currency == "USD":
        return Decimal("1")
    return get_fresh_rate(db, currency, "USD")


def _rate_from_usd(db: Session, currency: str) -> Decimal:
    if currency == "USD":
        return Decimal("1")
    return get_fresh_rate(db, "USD", currency)


def get_conversion_rate(db: Session, from_currency: str, to_currency: str) -> Decimal:
    """Tasa combinada from_currency -> to_currency, siempre pivoteando por USD (incluso
    si uno de los dos ya es USD, en cuyo caso ese tramo es un no-op de valor 1)."""
    if from_currency == to_currency:
        return Decimal("1")
    return _rate_to_usd(db, from_currency) * _rate_from_usd(db, to_currency)


def convert(db: Session, amount: Decimal, from_currency: str, to_currency: str) -> Decimal:
    """Convierte `amount` de from_currency a to_currency. Las tasas se cachean siempre
    relativas a USD como pivote: A -> B pasa por A -> USD -> B (ej. VEF -> EUR obtiene
    VEF/USD y EUR/USD y cruza por USD), nunca por una tasa directa A/B."""
    if from_currency == to_currency:
        return amount
    return amount * get_conversion_rate(db, from_currency, to_currency)


def get_conversion_rate_at(db: Session, from_currency: str, to_currency: str, at: datetime) -> Decimal:
    """Igual que get_conversion_rate, pero resolviendo la tasa que estaba vigente en
    `at` (una fecha pasada), no la de ahora - bug real reportado por el usuario: un
    gasto en una moneda con inflación fuerte (ej. VEF) pierde sentido histórico si
    siempre se reconvierte con la tasa de HOY (3.000 VEF de hace un mes valían más
    dólares que hoy). Usado por analytics_service.py para que un resumen de "los
    últimos N meses" no reescriba el pasado cada vez que la tasa se mueve."""
    if from_currency == to_currency:
        return Decimal("1")
    if "VEF" in (from_currency, to_currency):
        ensure_vef_history_covers(db, at)
    rate_to_usd = Decimal("1") if from_currency == "USD" else get_rate_at(db, from_currency, "USD", at)
    rate_from_usd = Decimal("1") if to_currency == "USD" else get_rate_at(db, "USD", to_currency, at)
    return rate_to_usd * rate_from_usd


def convert_at(db: Session, amount: Decimal, from_currency: str, to_currency: str, at: datetime) -> Decimal:
    """Igual que convert, pero con la tasa vigente en `at` (una fecha pasada) - ver
    get_conversion_rate_at. Usado por transaction_service.py para congelar el valor de
    referencia en USD de una transacción backdateada con SU propia tasa histórica, no
    la de hoy."""
    if from_currency == to_currency:
        return amount
    return amount * get_conversion_rate_at(db, from_currency, to_currency, at)


def reference_fields_in_usd(
    db: Session, amount: Decimal, currency: str, at: datetime
) -> tuple[Decimal | None, Decimal | None]:
    """Congela (reference_amount_usd, reference_rate) para `amount` en `currency` a la
    fecha `at`, usando get_conversion_rate_at (tasa histórica, ver docstring del
    módulo) - fuente única para transaction_service.py (crear/editar/backfillear una
    transaction) y para el self-heal de analytics_service.py.

    reference_rate queda en orientación "currency por USD" (ej. Bs por USD) - la forma
    en que el usuario pidió verla, no "USD por currency". (None, None) si currency ya
    es USD (el propio amount ya es la referencia) o si la conversión falla - best
    effort, un problema pasajero de la API de tasas no debe bloquear el registro."""
    if currency == "USD":
        return None, None
    try:
        rate_to_usd = get_conversion_rate_at(db, currency, "USD", at)
        if rate_to_usd == 0:
            return None, None
        reference_amount_usd = amount * rate_to_usd
        reference_rate = Decimal("1") / rate_to_usd
        return reference_amount_usd, reference_rate
    except Exception:
        return None, None


def build_conversion(db: Session, amount: Decimal, from_currency: str, to_currency: str) -> ConversionResource:
    """Lo que devuelve GET /currency/convert: el monto convertido y la tasa usada (a la
    tasa vigente, porque es para mostrar saldos de hoy)."""
    from_code, to_code = from_currency.upper(), to_currency.upper()
    return ConversionResource(
        converted_amount=convert(db, amount, from_code, to_code),
        rate_used=get_conversion_rate(db, from_code, to_code),
    )
