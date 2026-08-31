from decimal import Decimal

import httpx

# CoinGecko free endpoint no requiere API key, pero esta primera implementación deja
# igualmente el cliente sin conectar de verdad (ver plan de arquitectura: "conexión real
# diferida" para todos los clientes de tasas) — el fallback cubre la demo de hoy.
_FALLBACK_CRYPTO_RATES: dict[str, Decimal] = {
    "USDT": Decimal("1.0"),
}

_ENABLE_REAL_CALL = False  # cambiar a True (o wirearlo a un setting) cuando se conecte de verdad


def fetch_crypto_rates() -> dict[str, Decimal]:
    """Tasas cripto (USDT, ...) relativas a 1 USD."""
    if not _ENABLE_REAL_CALL:
        return dict(_FALLBACK_CRYPTO_RATES)

    # Llamado real a CoinGecko — queda escrito pero inalcanzable mientras
    # _ENABLE_REAL_CALL sea False.
    response = httpx.get(
        "https://api.coingecko.com/api/v3/simple/price",
        params={"ids": "tether", "vs_currencies": "usd"},
        timeout=10.0,
    )
    response.raise_for_status()
    data = response.json()
    return {"USDT": Decimal(str(data["tether"]["usd"]))}
