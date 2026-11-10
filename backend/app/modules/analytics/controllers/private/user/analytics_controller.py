import uuid
from datetime import date
from typing import Literal

from fastapi import Query

from app.common.security import CurrentUser, auth_group
from app.database import DbSession
from app.modules.analytics import services
from app.modules.analytics.contracts.enums import CompareAgainst, Granularity
from app.modules.analytics.contracts.resources import (
    CategoryBreakdownItemResource,
    CategoryMonthlyTrendResource,
    InsightResource,
    MonthlyComparisonItemResource,
    PeriodComparisonResource,
    PeriodSummaryResource,
    SpendingPatternsResource,
    TimelineResource,
    TopTransactionResource,
    WalletBreakdownItemResource,
)

router = auth_group()

_MONTH_QUERY = Query(default=None, description="Mes 'YYYY-MM'; default: mes actual")


@router.get("/summary", response_model=PeriodSummaryResource)
async def summary(
    db: DbSession,
    user: CurrentUser,
    month: str | None = Query(default=None, description="Mes 'YYYY-MM'; default: mes actual"),
) -> PeriodSummaryResource:
    return services.get_period_summary(db, user.id, month)


@router.get("/categories", response_model=list[CategoryBreakdownItemResource])
async def categories(
    db: DbSession,
    user: CurrentUser,
    type: Literal["income", "expense"] = Query(),
    month: str | None = Query(default=None, description="Mes 'YYYY-MM'; default: mes actual"),
) -> list[CategoryBreakdownItemResource]:
    return services.get_category_breakdown(db, user.id, type, month)


@router.get("/monthly", response_model=list[MonthlyComparisonItemResource])
async def monthly(
    db: DbSession, user: CurrentUser, months: int = Query(default=6, ge=1, le=24)
) -> list[MonthlyComparisonItemResource]:
    return services.get_monthly_comparison(db, user.id, months)


@router.get("/categories/trend", response_model=CategoryMonthlyTrendResource)
async def categories_trend(
    db: DbSession,
    user: CurrentUser,
    type: Literal["income", "expense"] = Query(),
    months: int = Query(default=6, ge=1, le=24),
) -> CategoryMonthlyTrendResource:
    return services.get_category_monthly_trend(db, user.id, type, months)


@router.get("/timeline", response_model=TimelineResource)
async def timeline(
    db: DbSession,
    user: CurrentUser,
    granularity: Granularity = Query(),
    date_from: date = Query(),
    date_to: date = Query(),
    wallet_id: uuid.UUID | None = Query(default=None),
) -> TimelineResource:
    return services.get_timeline(db, user.id, granularity, date_from, date_to, wallet_id)


@router.get("/compare", response_model=PeriodComparisonResource)
async def compare(
    db: DbSession,
    user: CurrentUser,
    month: str | None = _MONTH_QUERY,
    against: CompareAgainst = Query(default="previous"),
) -> PeriodComparisonResource:
    return services.get_period_comparison(db, user.id, month, against)


@router.get("/patterns", response_model=SpendingPatternsResource)
async def patterns(
    db: DbSession, user: CurrentUser, weeks: int = Query(default=8, ge=2, le=26)
) -> SpendingPatternsResource:
    return services.get_spending_patterns(db, user.id, weeks)


@router.get("/wallets", response_model=list[WalletBreakdownItemResource])
async def wallets(
    db: DbSession,
    user: CurrentUser,
    type: Literal["income", "expense"] = Query(default="expense"),
    month: str | None = _MONTH_QUERY,
) -> list[WalletBreakdownItemResource]:
    return services.get_wallet_breakdown(db, user.id, type, month)


@router.get("/top-transactions", response_model=list[TopTransactionResource])
async def top_transactions(
    db: DbSession,
    user: CurrentUser,
    type: Literal["income", "expense"] = Query(default="expense"),
    month: str | None = _MONTH_QUERY,
    limit: int = Query(default=5, ge=1, le=50),
) -> list[TopTransactionResource]:
    return services.get_top_transactions(db, user.id, type, month, limit)


@router.get("/insights", response_model=list[InsightResource])
async def insights(db: DbSession, user: CurrentUser, month: str | None = _MONTH_QUERY) -> list[InsightResource]:
    return services.get_insights(db, user.id, month)
