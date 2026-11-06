"""Mantiene completa la serie histórica real de la tasa del bolívar (BCV).

La guardia (ensure_vef_history_covers) y el relleno (backfill_historical_vef_rates) comparten
estado en memoria del proceso, por eso viven juntos."""

import logging
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.currency.models.exchange_rate_model import ExchangeRate
from app.modules.currency.services.currency_lookup import get_currency_by_code
from app.modules.currency.services.rates.rate_sanity import is_plausible_change
from app.modules.currency.services.rates import venezuela_rate_client


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
    series = venezuela_rate_client.fetch_vef_rate_history()
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
