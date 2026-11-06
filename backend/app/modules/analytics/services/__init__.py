"""Fachada del módulo: los controllers y la API pública solo hablan con esto."""

from app.modules.analytics.services.category_breakdown import get_category_breakdown, get_category_monthly_trend
from app.modules.analytics.services.period_summary import get_monthly_comparison, get_period_summary

__all__ = [
    "get_category_breakdown",
    "get_category_monthly_trend",
    "get_monthly_comparison",
    "get_period_summary",
]
