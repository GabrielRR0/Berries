"""Fachada del módulo: los controllers y la API pública solo hablan con esto."""

from app.modules.analytics.services.category_breakdown import get_category_breakdown, get_category_monthly_trend
from app.modules.analytics.services.insights import get_insights
from app.modules.analytics.services.period_comparison import get_period_comparison
from app.modules.analytics.services.period_summary import get_monthly_comparison, get_period_summary
from app.modules.analytics.services.spending_patterns import get_spending_patterns
from app.modules.analytics.services.timeline import get_timeline
from app.modules.analytics.services.top_transactions import get_top_transactions
from app.modules.analytics.services.wallet_breakdown import get_wallet_breakdown

__all__ = [
    "get_category_breakdown",
    "get_category_monthly_trend",
    "get_insights",
    "get_monthly_comparison",
    "get_period_comparison",
    "get_period_summary",
    "get_spending_patterns",
    "get_timeline",
    "get_top_transactions",
    "get_wallet_breakdown",
]
