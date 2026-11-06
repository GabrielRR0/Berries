from decimal import Decimal

import httpx

from app.config import settings

# Tasas de respaldo (aproximadas, relativas a USD) — placeholder mientras no haya un
# OPEN_EXCHANGE_RATES_APP_ID real configurado. Mantiene la conversión de moneda
# funcional y demostrable hoy sin depender de una key real.
#
# VEF (bolívar) NO vive acá - pedido explícito del usuario: para EUR/COP/ARS prefiere
# esta fuente "más internacional" (requiere conseguir una key propia), pero para
# bolívares específicamente prefiere no tramitar ninguna key - ver
# venezuela_rate_client.py (dolarapi.com, gratis y sin registro).
_FALLBACK_FIAT_RATES: dict[str, Decimal] = {
    "EUR": Decimal("0.92"),
    "COP": Decimal("4000"),
    "ARS": Decimal("1000"),
}


def fetch_fiat_rates() -> tuple[dict[str, Decimal], bool]:
    """Tasas fiat (EUR, COP, ARS...) relativas a 1 USD, vía Open Exchange Rates. VEF
    tiene su propio cliente (venezuela_rate_client.fetch_vef_rate) - nunca se resuelve
    acá, ver el comentario de _FALLBACK_FIAT_RATES arriba.

    Devuelve (rates, is_estimated). is_estimated=True mientras no haya una key real
    configurada (se usa el placeholder de abajo, no una lectura de mercado) - a
    diferencia de fetch_vef_rate, un fallo de la llamada real (con key configurada) NO
    se atrapa acá, se propaga tal cual."""
    if not settings.open_exchange_rates_app_id:
        return dict(_FALLBACK_FIAT_RATES), True

    # Llamado real a Open Exchange Rates — queda escrito pero es inalcanzable mientras
    # open_exchange_rates_app_id esté vacío. Conectarlo de verdad es remover el early
    # return de arriba una vez exista una key real.
    response = httpx.get(
        "https://openexchangerates.org/api/latest.json",
        params={"app_id": settings.open_exchange_rates_app_id, "base": "USD"},
        timeout=10.0,
    )
    response.raise_for_status()
    rates = response.json()["rates"]
    return {code: Decimal(str(value)) for code, value in rates.items()}, False
