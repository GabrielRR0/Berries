from decimal import Decimal

import httpx

from app.config import settings

# Tasas de respaldo (aproximadas, relativas a USD) — placeholder mientras no haya un
# OPEN_EXCHANGE_RATES_APP_ID real configurado. Mantiene la conversión de moneda
# funcional y demostrable hoy sin depender de una key real.
_FALLBACK_FIAT_RATES: dict[str, Decimal] = {
    "VEF": Decimal("36.5"),
    "EUR": Decimal("0.92"),
    "COP": Decimal("4000"),
    "ARS": Decimal("1000"),
}


def fetch_fiat_rates() -> dict[str, Decimal]:
    """Tasas fiat (VEF, EUR, ...) relativas a 1 USD."""
    if not settings.open_exchange_rates_app_id:
        return dict(_FALLBACK_FIAT_RATES)

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
    return {code: Decimal(str(value)) for code, value in rates.items()}
