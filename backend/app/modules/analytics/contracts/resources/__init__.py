"""Lo que SALE por HTTP: un modelo por respuesta."""

from app.modules.analytics.contracts.resources.category_breakdown_item_resource import CategoryBreakdownItemResource
from app.modules.analytics.contracts.resources.category_monthly_trend_item_resource import CategoryMonthlyTrendItemResource
from app.modules.analytics.contracts.resources.category_monthly_trend_resource import CategoryMonthlyTrendResource
from app.modules.analytics.contracts.resources.monthly_comparison_item_resource import MonthlyComparisonItemResource
from app.modules.analytics.contracts.resources.period_summary_resource import PeriodSummaryResource

__all__ = [
    "CategoryBreakdownItemResource",
    "CategoryMonthlyTrendItemResource",
    "CategoryMonthlyTrendResource",
    "MonthlyComparisonItemResource",
    "PeriodSummaryResource",
]
