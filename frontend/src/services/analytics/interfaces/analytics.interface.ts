// Formas publicas del dominio analytics - lo que composables/componentes
// conocen y usan. La forma "sobre el cable" (PeriodSummaryWire/
// CategoryBreakdownWire/MonthlyComparisonWire) y AnalyticsApiError son
// detalle de implementacion de analytics.service.ts.
export type AnalyticsCategoryType = 'income' | 'expense'

export interface PeriodSummary {
  period: string
  totalIncome: number
  totalExpense: number
  netSavings: number
  previousPeriodNetSavings: number
}

export interface CategoryBreakdown {
  category: string
  total: number
  percentage: number
}

export interface MonthlyComparison {
  month: string
  totalIncome: number
  totalExpense: number
  net: number
}
