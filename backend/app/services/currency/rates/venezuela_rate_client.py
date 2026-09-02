from decimal import Decimal

import httpx

# Respaldo (aproximado, relativo a USD) - solo se usa si dolarapi.com no responde.
_FALLBACK_VEF_RATE = Decimal("36.5")


def fetch_vef_rate() -> Decimal:
    """Tasa oficial del bolívar (VEF) relativa a 1 USD, vía dolarapi.com — API pública
    de Venezuela, gratuita y SIN necesidad de registrarse ni conseguir una key. Pedido
    explícito del usuario: para EUR/COP/ARS prefiere Open Exchange Rates (más
    "internacional", requiere una key propia - ver fiat_rate_client.py), pero para
    bolívares prefiere específicamente no tener que tramitar ninguna key, una fuente
    local y gratis alcanza.

    A diferencia de fetch_fiat_rates()/fetch_crypto_rates() (que solo intentan la
    llamada real una vez que alguien configura una key), esta SIEMPRE intenta la
    llamada real - no hay ninguna key que configurar para que se active. Por eso, a
    diferencia de esas dos, sí atrapa errores de red/formato acá mismo y cae al
    respaldo, en vez de dejar que un problema pasajero de un servicio externo gratuito
    (sin SLA) tumbe cualquier conversión que involucre VEF."""
    try:
        response = httpx.get("https://ve.dolarapi.com/v1/dolares/oficial", timeout=10.0)
        response.raise_for_status()
        return Decimal(str(response.json()["promedio"]))
    except (httpx.HTTPError, KeyError, ValueError, TypeError):
        return _FALLBACK_VEF_RATE
