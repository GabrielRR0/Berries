from datetime import date
from decimal import Decimal

import httpx

# Respaldo (aproximado, relativo a USD) - solo se usa si dolarapi.com no responde.
_FALLBACK_VEF_RATE = Decimal("36.5")


def fetch_vef_rate() -> tuple[Decimal, bool]:
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
    (sin SLA) tumbe cualquier conversión que involucre VEF.

    Devuelve (rate, is_estimated). is_estimated=True significa que dolarapi.com no
    respondió (o respondió con un formato inesperado) y se usó el respaldo hardcodeado
    de arriba - un valor que puede estar muy desactualizado dada la inflación del
    bolívar. Quien llama a esta función NO debe guardar ese número como si fuera una
    lectura real de mercado - ver get_fresh_rate en cache_refresh.py, que en ese caso
    prefiere reusar la última tasa REAL ya conocida en vez de este respaldo."""
    try:
        response = httpx.get("https://ve.dolarapi.com/v1/dolares/oficial", timeout=10.0)
        response.raise_for_status()
        return Decimal(str(response.json()["promedio"])), False
    except (httpx.HTTPError, KeyError, ValueError, TypeError):
        return _FALLBACK_VEF_RATE, True


def fetch_vef_rate_history() -> list[tuple[date, Decimal]]:
    """Serie histórica COMPLETA del promedio diario de la tasa oficial (BCV), vía el
    mismo proveedor (dolarapi.com) - un valor por cada día hábil, desde que tienen
    registro (~2023) hasta hoy, en una sola llamada. Pedido explícito del usuario:
    "buscar registros anteriores... de hace un año para acá" - a diferencia de
    fetch_vef_rate (solo el valor de HOY), este endpoint trae todo el histórico de
    una vez. Usado solo para backfill (ver
    currency_service.backfill_historical_vef_rates), nunca en el camino de crear una
    transacción - si falla, se propaga el error tal cual (un backfill puede
    reintentarse más tarde, no hace falta un respaldo hardcodeado para un año entero
    de datos)."""
    response = httpx.get("https://ve.dolarapi.com/v1/historicos/dolares/oficial", timeout=30.0)
    response.raise_for_status()
    entries = response.json()
    return [
        (date.fromisoformat(entry["fecha"]), Decimal(str(entry["promedio"])))
        for entry in entries
        if entry.get("promedio") is not None
    ]
