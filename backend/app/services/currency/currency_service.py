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

import logging
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.auth.user_model import User
from app.models.currency.currency_model import Currency
from app.models.currency.exchange_rate_model import ExchangeRate
from app.models.transactions.transaction_model import Transaction
from app.models.wallets.wallet_model import Wallet
from app.services.currency.currency_lookup import get_currency_by_code
from app.services.currency.rates.cache_refresh import get_fresh_rate, get_rate_at
from app.services.currency.rates.rate_sanity import is_plausible_change
from app.services.currency.rates.venezuela_rate_client import fetch_vef_rate_history

logger = logging.getLogger(__name__)

HISTORICAL_VEF_SOURCE = "dolarapi-oficial-historico"

# El BCV solo publica tasa en dias habiles: un fin de semana (o un puente) deja hasta 3-4 dias sin
# dato nuevo, y eso es normal. Mas que eso, la tasa guardada mas cercana ya no representa esa
# fecha (en una moneda con inflacion fuerte, diez dias de diferencia son cientos de bolivares).
VEF_MAX_RATE_GAP = timedelta(days=3)
# Para no llamar a la API en cada movimiento: tras un intento (con o sin exito) no se vuelve a
# intentar durante este tiempo, y los dias ya comprobados no se vuelven a consultar.
_VEF_BACKFILL_COOLDOWN = timedelta(hours=1)
_last_vef_backfill_attempt: datetime | None = None
_vef_days_checked: set[date] = set()
# Ultimo dia que trajo la serie historica del proveedor en la ultima actualizacion exitosa. La serie
# llega COMPLETA en una sola respuesta (todos los dias habiles hasta hoy), asi que cualquier fecha
# hasta ese dia ya esta cubierta y no hace falta volver a preguntar: solo una fecha posterior (un dia
# nuevo que aun no se habia publicado) justifica otra llamada.
_vef_history_covered_through: date | None = None


def reset_vef_history_guard() -> None:
    """Reinicia el estado en memoria de la guardia (lo usan los tests; en produccion cada
    proceso arranca limpio)."""
    global _last_vef_backfill_attempt, _vef_history_covered_through
    _last_vef_backfill_attempt = None
    _vef_history_covered_through = None
    _vef_days_checked.clear()


def _as_utc(value: datetime) -> datetime:
    return value if value.tzinfo is not None else value.replace(tzinfo=timezone.utc)


def ensure_vef_history_covers(db: Session, at: datetime) -> None:
    """Garantiza que la serie guardada de la tasa del bolivar cubra la fecha `at`: si la fila
    mas reciente con fetched_at <= `at` esta a mas de VEF_MAX_RATE_GAP (o no hay ninguna), trae
    el historico REAL del proveedor (backfill_historical_vef_rates, idempotente: solo agrega los
    dias que falten) antes de resolver la tasa.

    Bug real: get_rate_at toma la fila mas reciente anterior a la fecha SIN mirar que tan vieja
    es. Si nadie refresco las tasas en 10 dias (el cron diario solo corre en Vercel, no en local),
    un gasto del 8 de octubre se congelaba con la tasa del 28 de septiembre (857,01 en vez de
    874,73). Antes el hueco solo se curaba con `manage.py backfill:vef-rate-history` o con el cron.

    Es una ayuda de mejor esfuerzo: si el proveedor no responde, se sigue con lo que haya (nunca
    debe impedir registrar un movimiento). Hace commit al insertar, asi que quien registra varios
    movimientos a la vez debe llamarla ANTES de tocar saldos (ver warm_reference_rates)."""
    global _last_vef_backfill_attempt
    at_utc = _as_utc(at)
    if at_utc.date() in _vef_days_checked:
        return
    # La ultima actualizacion ya trajo todos los dias hasta esa fecha: no se vuelve a preguntar.
    if _vef_history_covered_through is not None and at_utc.date() <= _vef_history_covered_through:
        return

    usd = get_currency_by_code(db, "USD")
    vef = get_currency_by_code(db, "VEF")
    latest = db.scalar(
        select(ExchangeRate.fetched_at)
        .where(
            ExchangeRate.base_currency_id == vef.id,
            ExchangeRate.quote_currency_id == usd.id,
            ExchangeRate.is_estimated.is_(False),
            ExchangeRate.fetched_at <= at_utc,
        )
        .order_by(ExchangeRate.fetched_at.desc())
        .limit(1)
    )
    if latest is not None and at_utc - _as_utc(latest) <= VEF_MAX_RATE_GAP:
        _vef_days_checked.add(at_utc.date())
        return

    now = datetime.now(timezone.utc)
    if _last_vef_backfill_attempt is not None and now - _last_vef_backfill_attempt < _VEF_BACKFILL_COOLDOWN:
        return
    _last_vef_backfill_attempt = now
    try:
        backfill_historical_vef_rates(db)
    except Exception:
        # Proveedor caido o respuesta inesperada: se sigue con la tasa mas cercana que haya.
        return
    _vef_days_checked.add(at_utc.date())


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


def get_rate_history(db: Session, code: str, months: int = 6, against: str = "USD") -> list[ExchangeRate]:
    """Serie histórica `against` -> `code` (misma orientación que reference_rate) para
    la página "Tasas" - consulta directa sobre ExchangeRate, que ya es un log
    append-only (nunca se pisa una fila al refrescar, ver cache_refresh.py) - no hace
    falta ninguna tabla nueva. Ascendente por fetched_at.

    `against` por default es "USD" (la tasa oficial/de mercado, ver cache_refresh.py).
    Pasar "USDT" trae en cambio la serie de tasas IMPLÍCITAS reales que el propio
    usuario obtuvo en sus transferencias USDT<->`code` (ver
    transfer_service._record_transfer_rate_observation) - pedido explícito del
    usuario: poder comparar la tasa oficial contra la que él de verdad consigue."""
    against_id = get_currency_by_code(db, against).id
    quote_id = get_currency_by_code(db, code).id
    since = datetime.now(timezone.utc) - timedelta(days=months * 30)
    return list(
        db.scalars(
            select(ExchangeRate)
            .where(
                ExchangeRate.base_currency_id == against_id,
                ExchangeRate.quote_currency_id == quote_id,
                ExchangeRate.fetched_at >= since,
            )
            .order_by(ExchangeRate.fetched_at.asc())
        )
    )


def backfill_historical_vef_rates(db: Session, months: int = 12) -> int:
    """Rellena ExchangeRate con el histórico REAL de la tasa oficial (BCV) de los
    últimos `months` meses - pedido explícito del usuario: "buscar registros
    anteriores... de hace un año para acá", no solo lo que la app cacheó on-demand
    desde que arrancó. dolarapi.com expone la serie completa desde ~2023 en una sola
    llamada (fetch_vef_rate_history) - acá se recorta a la ventana pedida y se
    insertan las filas que todavía no existan.

    Idempotente: compara por DÍA (no por fetched_at exacto), así que correrlo de
    nuevo - incluso desde el cron diario, ver refresh_all_active_currencies más abajo
    - nunca duplica un día ya guardado, solo agrega los que falten (ej. si el cron no
    corrió un día, el próximo backfill lo completa solo).

    Guarda ambas direcciones (VEF->USD y USD->VEF), mismo criterio que
    refresh_all_active_currencies - get_conversion_rate/get_rate_at pivotean sobre
    cualquiera de las dos según cuál sea la moneda de origen. source="dolarapi-
    oficial-historico" (distinto de "dolarapi-oficial", que es la lectura EN VIVO de
    fetch_vef_rate) para poder distinguir en el futuro de dónde salió cada fila si
    hiciera falta. is_estimated=False - es un dato real publicado, no un respaldo."""
    usd = get_currency_by_code(db, "USD")
    vef = get_currency_by_code(db, "VEF")
    cutoff = (datetime.now(timezone.utc) - timedelta(days=months * 30)).date()

    existing_dates = {
        row.fetched_at.date()
        for row in db.scalars(
            select(ExchangeRate).where(
                ExchangeRate.base_currency_id == vef.id, ExchangeRate.quote_currency_id == usd.id
            )
        )
    }

    global _vef_history_covered_through
    series = fetch_vef_rate_history()
    if series:
        _vef_history_covered_through = max(day for day, _ in series)

    inserted = 0
    # Ultimo dia aceptado de la serie: cada dia se compara con el anterior, y uno que salte de golpe (un dato
    # corrupto del proveedor) se omite en vez de guardarse como real.
    previous: tuple[date, Decimal] | None = None
    for day, promedio in sorted(series):
        if previous is not None and not is_plausible_change(
            promedio, previous[1], timedelta(days=(day - previous[0]).days)
        ):
            logger.warning("Historico VEF: se omite %s (%s) por saltar de golpe frente a %s (%s)", day, promedio, *previous)
            continue
        previous = (day, promedio)

        # promedio = "cuántos VEF equivalen a 1 USD" (ej. 850) - la convención de
        # ExchangeRate.rate es "cuántas unidades de quote equivalen a 1 de base" (ver
        # _fetch_rate_from_client en cache_refresh.py, la fuente de verdad de esta
        # orientación): para base=USD/quote=VEF el propio promedio ya es esa cifra
        # directa; para base=VEF/quote=USD hay que INVERTIRLO (1/promedio). Bug real
        # de esta misma sesión: tenían las dos al revés, lo que multiplicaba (en vez
        # de dividir) cualquier monto en VEF por ~850 en vez de por ~0.00118 - se
        # detectó por el propio --dry-run de backfill:reference-amounts (valores que
        # saltaban a millones de dólares), antes de tocar datos reales.
        if day < cutoff or day in existing_dates:
            continue
        fetched_at = datetime(day.year, day.month, day.day, tzinfo=timezone.utc)
        db.add(
            ExchangeRate(
                base_currency_id=vef.id,
                quote_currency_id=usd.id,
                rate=Decimal("1") / promedio,
                fetched_at=fetched_at,
                source=HISTORICAL_VEF_SOURCE,
                is_estimated=False,
            )
        )
        db.add(
            ExchangeRate(
                base_currency_id=usd.id,
                quote_currency_id=vef.id,
                rate=promedio,
                fetched_at=fetched_at,
                source=HISTORICAL_VEF_SOURCE,
                is_estimated=False,
            )
        )
        existing_dates.add(day)
        inserted += 1

    db.commit()
    return inserted


def refresh_all_active_currencies(db: Session) -> list[str]:
    """Refresca (o confirma vigente, según currency_cache_ttl_hours) la tasa USD<->X de
    cada moneda que la app realmente usa hoy - las que tiene alguna wallet o el
    default_currency de algún usuario. get_fresh_rate ya resuelve la tasa on-demand
    cuando alguien la necesita (crea un movimiento, entra a Análisis...), pero si nadie
    visita la app un día entero ese día no queda ninguna tasa registrada - pedido
    explícito del usuario ("una vez al día... si nadie entró un día se actualiza").
    Pensado para que lo llame el cron diario de Vercel (ver cron_router.py), nunca un
    usuario final.

    Refresca ambas direcciones (código->USD y USD->código) porque get_conversion_rate
    pivotea siempre por USD (ver _rate_to_usd/_rate_from_usd arriba) y cachea cada
    dirección como su propia fila de ExchangeRate.

    Si VEF está entre las monedas activas, también corre backfill_historical_vef_rates
    - autocura cualquier hueco en el histórico (ej. si el cron no llegó a correr un
    día) usando la serie real de dolarapi.com, no una tasa de HOY retroactiva."""
    wallet_currencies = db.scalars(select(Currency.code).join(Wallet, Wallet.currency_id == Currency.id).distinct())
    user_currencies = db.scalars(select(Currency.code).join(User, User.default_currency_id == Currency.id).distinct())
    codes = sorted((set(wallet_currencies) | set(user_currencies)) - {"USD"})

    for code in codes:
        get_fresh_rate(db, code, "USD")
        get_fresh_rate(db, "USD", code)

    if "VEF" in codes:
        backfill_historical_vef_rates(db)

    return codes


@dataclass
class RateAudit:
    """Resultado de comparar lo guardado con la serie real del proveedor (ver audit_vef_rates)."""

    bad_rates: list[dict] = field(default_factory=list)
    affected_transactions: list[dict] = field(default_factory=list)

    @property
    def is_clean(self) -> bool:
        return not self.bad_rates and not self.affected_transactions


def audit_vef_rates(db: Session, tolerance: Decimal = Decimal("0.10")) -> RateAudit:
    """Detecta datos de tasa del bolivar que ya esten mal: filas de ExchangeRate y movimientos cuyo valor de
    referencia congelado se aparten mas de `tolerance` (10 % por defecto) de la tasa publicada ese dia por el
    proveedor. Es de solo lectura. Si encuentra algo, la reparacion es borrar la fila mala y correr
    `manage.py backfill:reference-amounts`. Pensado para correrse de vez en cuando (`manage.py check:rates`):
    el chequeo de sensatez al guardar (rate_sanity.py) PREVIENE, esto DETECTA lo que se haya colado.

    Un dia sin dato (fin de semana) se compara con el ultimo dia habil anterior."""
    history = dict(fetch_vef_rate_history())

    def published_for(day: date) -> Decimal | None:
        for back in range(7):
            value = history.get(day - timedelta(days=back))
            if value is not None:
                return value
        return None

    usd = get_currency_by_code(db, "USD")
    vef = get_currency_by_code(db, "VEF")
    audit = RateAudit()

    for row in db.scalars(select(ExchangeRate).order_by(ExchangeRate.fetched_at)):
        if {row.base_currency_id, row.quote_currency_id} != {usd.id, vef.id}:
            continue
        bs_per_usd = row.rate if row.base_currency_id == usd.id else Decimal("1") / row.rate
        published = published_for(row.fetched_at.date())
        if published is not None and abs(bs_per_usd - published) / published > tolerance:
            audit.bad_rates.append(
                {
                    "id": str(row.id),
                    "fetched_at": row.fetched_at.isoformat(),
                    "bs_per_usd": round(bs_per_usd, 4),
                    "published": published,
                    "source": row.source,
                    "is_estimated": row.is_estimated,
                }
            )

    for transaction in db.scalars(select(Transaction)):
        if transaction.reference_rate is None or transaction.currency != "VEF":
            continue
        published = published_for(transaction.occurred_at.date())
        if published is not None and abs(transaction.reference_rate - published) / published > tolerance:
            audit.affected_transactions.append(
                {
                    "id": str(transaction.id),
                    "occurred_on": transaction.occurred_at.date().isoformat(),
                    "stored_rate": round(transaction.reference_rate, 2),
                    "published": published,
                }
            )
    return audit
