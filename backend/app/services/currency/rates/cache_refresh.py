import logging
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.models.currency.exchange_rate_model import ExchangeRate
from app.services.currency.currency_lookup import get_currency_by_code
from app.services.currency.rates.crypto_rate_client import fetch_crypto_rates
from app.services.currency.rates.fiat_rate_client import fetch_fiat_rates
from app.services.currency.rates.rate_sanity import is_plausible_change
from app.services.currency.rates.venezuela_rate_client import fetch_vef_rate

logger = logging.getLogger(__name__)


def _fetch_rate_from_client(base_currency: str, quote_currency: str) -> tuple[Decimal, str, bool]:
    """Resuelve una tasa directa donde uno de los dos lados es USD o USDT (los únicos
    pivotes que los clientes de tasas conocen). Pares sin USD/USDT en ninguno de los dos
    lados deben resolverse en currency_service pivoteando por USD, no acá.

    VEF (bolívar) se resuelve con su propio cliente (fetch_vef_rate, dolarapi.com) en
    vez de con fetch_fiat_rates (Open Exchange Rates) - pedido explícito del usuario:
    para EUR/COP/ARS prefiere una fuente "más internacional" con key propia, pero para
    bolívares prefiere específicamente no tramitar ninguna key.

    Devuelve (rate, source, is_estimated) - `source` identifica de qué cliente salió el
    número (para guardarlo en ExchangeRate.source) e `is_estimated` si esa lectura NO
    es un dato de mercado real ahora mismo (placeholder sin key configurada, o el
    respaldo de emergencia de VEF) - ver el docstring de cada cliente."""
    if quote_currency == "USDT":
        rates, is_estimated = fetch_crypto_rates()
        return rates["USDT"], ("crypto-fallback" if is_estimated else "coingecko"), is_estimated
    if base_currency == "USDT":
        rates, is_estimated = fetch_crypto_rates()
        return Decimal("1") / rates["USDT"], ("crypto-fallback" if is_estimated else "coingecko"), is_estimated

    if quote_currency == "VEF":
        rate, is_estimated = fetch_vef_rate()
        return rate, ("fallback-stale" if is_estimated else "dolarapi-oficial"), is_estimated
    if base_currency == "VEF":
        rate, is_estimated = fetch_vef_rate()
        return Decimal("1") / rate, ("fallback-stale" if is_estimated else "dolarapi-oficial"), is_estimated

    if base_currency == "USD":
        rates, is_estimated = fetch_fiat_rates()
        return rates[quote_currency], ("fiat-fallback" if is_estimated else "open-exchange-rates"), is_estimated
    if quote_currency == "USD":
        rates, is_estimated = fetch_fiat_rates()
        return (
            Decimal("1") / rates[base_currency],
            ("fiat-fallback" if is_estimated else "open-exchange-rates"),
            is_estimated,
        )

    raise ValueError(f"No se puede resolver una tasa directa para {base_currency}/{quote_currency}")


def get_fresh_rate(db: Session, base_currency: str, quote_currency: str) -> Decimal:
    """Busca la fila de ExchangeRate más reciente para este par; si no existe o está
    stale (más vieja que currency_cache_ttl_hours), refresca on-demand contra el cliente
    correspondiente y guarda una fila nueva. Mismo patrón que expire_on_access de s-rank
    — sin cron, el refresco ocurre en la request que lo necesita.

    base_currency/quote_currency siguen siendo códigos (str) en la firma - la tabla
    ExchangeRate guarda FKs a currencies, pero _fetch_rate_from_client y los clientes de
    tasas (fiat/crypto) siguen operando sobre códigos, así que la resolución a id ocurre
    solo acá, en el borde donde se consulta/inserta la fila.

    Si el cliente devuelve un valor estimado (is_estimated=True - placeholder sin key,
    o el respaldo de emergencia de VEF cuando dolarapi.com falla), NO se guarda ese
    número tal cual: se prefiere la última tasa REAL (is_estimated=False) que ya exista
    para este par, marcando la fila nueva como reutilizada/estimada igual - un respaldo
    hardcodeado puede estar desactualizado por años (ver venezuela_rate_client.py), y
    nunca debe reemplazar silenciosamente un dato de mercado real ya conocido. Solo si
    NUNCA hubo una lectura real para este par se guarda el propio valor estimado."""
    base_id = get_currency_by_code(db, base_currency).id
    quote_id = get_currency_by_code(db, quote_currency).id

    existing = db.scalar(
        select(ExchangeRate)
        .where(ExchangeRate.base_currency_id == base_id, ExchangeRate.quote_currency_id == quote_id)
        .order_by(ExchangeRate.fetched_at.desc())
    )

    if existing is not None:
        fetched_at = existing.fetched_at
        if fetched_at.tzinfo is None:
            fetched_at = fetched_at.replace(tzinfo=timezone.utc)
        max_age = timedelta(hours=settings.currency_cache_ttl_hours)
        if datetime.now(timezone.utc) - fetched_at < max_age:
            return existing.rate

    rate, source, is_estimated = _fetch_rate_from_client(base_currency, quote_currency)

    last_real = db.scalar(
        select(ExchangeRate)
        .where(
            ExchangeRate.base_currency_id == base_id,
            ExchangeRate.quote_currency_id == quote_id,
            ExchangeRate.is_estimated.is_(False),
        )
        .order_by(ExchangeRate.fetched_at.desc())
    )

    # Chequeo de sensatez: una lectura marcada como real pero que se aparta de golpe de la ultima real (un
    # respaldo viejo, un error del proveedor...) NO se guarda como dato de mercado: se trata como estimada y se
    # reutiliza la ultima real. Bug real: una fila de 36,5 Bs por USD guardada como real (cuando valia ~850)
    # congelo un gasto de 36.500 Bs como $1.000.
    suspicious = False
    if not is_estimated and last_real is not None:
        last_at = last_real.fetched_at if last_real.fetched_at.tzinfo else last_real.fetched_at.replace(tzinfo=timezone.utc)
        if not is_plausible_change(rate, last_real.rate, datetime.now(timezone.utc) - last_at):
            logger.warning(
                "Tasa sospechosa %s/%s: %s (fuente %s) frente a la ultima real %s; se reutiliza la ultima real",
                base_currency,
                quote_currency,
                rate,
                source,
                last_real.rate,
            )
            suspicious = True
            is_estimated = True

    if is_estimated and last_real is not None:
        rate = last_real.rate
        source = f"{last_real.source or source}-suspicious-reused" if suspicious else (
            f"{last_real.source}-reused" if last_real.source else source
        )

    row = ExchangeRate(
        base_currency_id=base_id,
        quote_currency_id=quote_id,
        rate=rate,
        fetched_at=datetime.now(timezone.utc),
        source=source,
        is_estimated=is_estimated,
    )
    db.add(row)
    db.commit()
    return rate


def get_rate_at(db: Session, base_currency: str, quote_currency: str, at: datetime) -> Decimal:
    """Como get_fresh_rate, pero para una transacción ya pasada (fecha `at`), no para
    "ahora" - bug real reportado por el usuario: convertir un gasto viejo en una moneda
    con inflación fuerte (ej. VEF) usando la tasa de HOY distorsiona su valor histórico
    (3.000 VEF de hace un mes valían más dólares que hoy). Se busca la fila de
    ExchangeRate más reciente cuyo fetched_at sea <= `at` (nunca una tasa del FUTURO
    respecto a la transacción) - get_fresh_rate/cache_refresh nunca pisan una fila
    vieja (siempre INSERTan una nueva al refrescar, ver el INSERT de arriba), así que el
    historial de tasas pasadas queda disponible para esta consulta.

    Si el par nunca se consultó antes de `at` (ej. la primera vez que esta moneda se usa
    en la app es HOY, para una transacción de hace 3 meses), la mejor ancla histórica
    real disponible es la fila MÁS VIEJA que exista para el par, aunque sea posterior a
    `at` - nunca una tasa de HOY (get_fresh_rate) mal etiquetada como histórica, que
    para una moneda con inflación fuerte distorsiona el valor mucho más. Solo si el par
    nunca se consultó ni antes ni después de `at` (no existe ninguna fila) cae a
    get_fresh_rate, que además la crea."""
    base_id = get_currency_by_code(db, base_currency).id
    quote_id = get_currency_by_code(db, quote_currency).id

    # Una lectura REAL siempre gana a una estimada (el respaldo hardcodeado de un cliente de tasas,
    # ver get_fresh_rate): una tasa estimada mas reciente no debe tapar una real mas vieja - asi una
    # fila de respaldo (ej. 36,5 Bs por USD) no puede congelar el valor de un gasto. Las estimadas solo
    # se usan si para ese par no hay ninguna real.
    for real_only in (True, False):
        conditions = [ExchangeRate.base_currency_id == base_id, ExchangeRate.quote_currency_id == quote_id]
        if real_only:
            conditions.append(ExchangeRate.is_estimated.is_(False))

        row = db.scalar(
            select(ExchangeRate)
            .where(*conditions, ExchangeRate.fetched_at <= at)
            .order_by(ExchangeRate.fetched_at.desc())
        )
        if row is not None:
            return row.rate

        oldest = db.scalar(select(ExchangeRate).where(*conditions).order_by(ExchangeRate.fetched_at.asc()))
        if oldest is not None:
            return oldest.rate

    return get_fresh_rate(db, base_currency, quote_currency)
