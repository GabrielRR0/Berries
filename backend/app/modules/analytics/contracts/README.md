# contracts/ — analytics

Todo lo que entra y sale por HTTP, y nada más. No importa de controllers ni de services (solo al revés).

## `resources/` — lo que SALE (una clase por respuesta)

- `category_breakdown_item_resource.py` — `CategoryBreakdownItemResource`
- `category_monthly_trend_item_resource.py` — `CategoryMonthlyTrendItemResource`
- `category_monthly_trend_resource.py` — `CategoryMonthlyTrendResource`
- `monthly_comparison_item_resource.py` — `MonthlyComparisonItemResource`
- `period_summary_resource.py` — `PeriodSummaryResource`
- `category_comparison_item_resource.py` — `CategoryComparisonItemResource`
- `heat_cell_resource.py` — `HeatCellResource`
- `insight_resource.py` — `InsightResource`
- `period_comparison_resource.py` — `PeriodComparisonResource`
- `spending_patterns_resource.py` — `SpendingPatternsResource`
- `timeline_bucket_resource.py` — `TimelineBucketResource`
- `timeline_resource.py` — `TimelineResource`
- `top_transaction_resource.py` — `TopTransactionResource`
- `wallet_breakdown_item_resource.py` — `WalletBreakdownItemResource`
- `weekday_average_resource.py` — `WeekdayAverageResource`

`enums.py` — valores permitidos compartidos (`Granularity`, `CompareAgainst`, `InsightLevel`).
