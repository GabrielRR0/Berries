"""Monedas y tasas de cambio: catálogo, conversión, historial y refresco diario.

Lo único que otros módulos pueden importar (ver app/common/modules/public_api.py).
"""

from typing import TYPE_CHECKING

from app.common.modules import public_api

if TYPE_CHECKING:
    from app.modules.currency.errors import UnsupportedCurrencyError
    from app.modules.currency.models.currency_model import Currency
    from app.modules.currency.models.exchange_rate_model import ExchangeRate
    from app.modules.currency.services.currency_lookup import get_currency_by_code
    from app.modules.currency.services.currency_service import (
        audit_vef_rates,
        backfill_historical_vef_rates,
        get_conversion_rate,
        reference_fields_in_usd,
        reset_vef_history_guard,
    )
    from app.modules.currency.utils.pegged_currencies import currencies_are_equivalent
    from app.modules.currency.utils.supported_currencies import SUPPORTED_CURRENCIES

__getattr__, __dir__, __all__ = public_api(__name__, __file__)
