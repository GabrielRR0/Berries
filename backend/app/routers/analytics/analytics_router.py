from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.models.auth.user_model import User
from app.schemas.analytics.analytics_schemas import (
    CategoryBreakdownItem,
    CategoryMonthlyTrendResponse,
    MonthlyComparisonItem,
    PeriodSummaryResponse,
)
from app.services.analytics.analytics_service import (
    get_category_breakdown,
    get_category_monthly_trend,
    get_monthly_comparison,
    get_period_summary,
)
from app.services.analytics.errors import InvalidPeriodError

router = APIRouter()


@router.get("/summary", response_model=PeriodSummaryResponse)
async def summary(
    month: str | None = Query(default=None, description="Mes 'YYYY-MM'; default: mes actual"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PeriodSummaryResponse:
    try:
        return get_period_summary(db, current_user.id, month)
    except InvalidPeriodError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc


@router.get("/categories", response_model=list[CategoryBreakdownItem])
async def categories(
    type: Literal["income", "expense"] = Query(),
    month: str | None = Query(default=None, description="Mes 'YYYY-MM'; default: mes actual"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[CategoryBreakdownItem]:
    try:
        return get_category_breakdown(db, current_user.id, type, month)
    except InvalidPeriodError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc


@router.get("/monthly", response_model=list[MonthlyComparisonItem])
async def monthly(
    months: int = Query(default=6, ge=1, le=24),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[MonthlyComparisonItem]:
    return get_monthly_comparison(db, current_user.id, months)


@router.get("/categories/trend", response_model=CategoryMonthlyTrendResponse)
async def categories_trend(
    type: Literal["income", "expense"] = Query(),
    months: int = Query(default=6, ge=1, le=24),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CategoryMonthlyTrendResponse:
    return get_category_monthly_trend(db, current_user.id, type, months)
