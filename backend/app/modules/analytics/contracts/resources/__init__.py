"""Lo que SALE por HTTP: un modelo por respuesta."""

from app.modules.analytics.contracts.resources.category_breakdown_item_resource import CategoryBreakdownItemResource
from app.modules.analytics.contracts.resources.category_comparison_item_resource import CategoryComparisonItemResource
from app.modules.analytics.contracts.resources.category_monthly_trend_item_resource import CategoryMonthlyTrendItemResource
from app.modules.analytics.contracts.resources.category_monthly_trend_resource import CategoryMonthlyTrendResource
from app.modules.analytics.contracts.resources.heat_cell_resource import HeatCellResource
from app.modules.analytics.contracts.resources.insight_resource import InsightResource
from app.modules.analytics.contracts.resources.monthly_comparison_item_resource import MonthlyComparisonItemResource
from app.modules.analytics.contracts.resources.period_comparison_resource import PeriodComparisonResource
from app.modules.analytics.contracts.resources.period_summary_resource import PeriodSummaryResource
from app.modules.analytics.contracts.resources.spending_patterns_resource import SpendingPatternsResource
from app.modules.analytics.contracts.resources.timeline_bucket_resource import TimelineBucketResource
from app.modules.analytics.contracts.resources.timeline_resource import TimelineResource
from app.modules.analytics.contracts.resources.top_transaction_resource import TopTransactionResource
from app.modules.analytics.contracts.resources.wallet_breakdown_item_resource import WalletBreakdownItemResource
from app.modules.analytics.contracts.resources.weekday_average_resource import WeekdayAverageResource

__all__ = [
    "CategoryBreakdownItemResource",
    "CategoryComparisonItemResource",
    "CategoryMonthlyTrendItemResource",
    "CategoryMonthlyTrendResource",
    "HeatCellResource",
    "InsightResource",
    "MonthlyComparisonItemResource",
    "PeriodComparisonResource",
    "PeriodSummaryResource",
    "SpendingPatternsResource",
    "TimelineBucketResource",
    "TimelineResource",
    "TopTransactionResource",
    "WalletBreakdownItemResource",
    "WeekdayAverageResource",
]
