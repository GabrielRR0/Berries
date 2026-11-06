"""Fachada del módulo: los controllers y la API pública solo hablan con esto."""

from app.modules.currency.services.conversion_service import (
    build_conversion,
    convert,
    convert_at,
    get_conversion_rate,
    get_conversion_rate_at,
    reference_fields_in_usd,
)
from app.modules.currency.services.currency_lookup import get_currency_by_code
from app.modules.currency.services.history.rate_history import build_rate_history, get_rate_history
from app.modules.currency.services.history.vef_history import (
    backfill_historical_vef_rates,
    ensure_vef_history_covers,
    reset_vef_history_guard,
)
from app.modules.currency.services.history.vef_rate_audit import RateAudit, audit_vef_rates
from app.modules.currency.services.rates.daily_refresh import refresh_all_active_currencies

__all__ = [
    "RateAudit",
    "audit_vef_rates",
    "backfill_historical_vef_rates",
    "build_conversion",
    "build_rate_history",
    "convert",
    "convert_at",
    "ensure_vef_history_covers",
    "get_conversion_rate",
    "get_conversion_rate_at",
    "get_currency_by_code",
    "get_rate_history",
    "reference_fields_in_usd",
    "refresh_all_active_currencies",
    "reset_vef_history_guard",
]
