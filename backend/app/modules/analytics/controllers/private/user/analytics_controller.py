from typing import Literal

from fastapi import Query

from app.common.security import CurrentUser, auth_group
from app.database import DbSession
from app.modules.analytics import services
from app.modules.analytics.contracts.resources import (
    CategoryBreakdownItemResource,
    CategoryMonthlyTrendResource,
    MonthlyComparisonItemResource,
    PeriodSummaryResource,
)

router = auth_group()


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
