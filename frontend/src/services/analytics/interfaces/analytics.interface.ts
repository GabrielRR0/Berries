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
  // null: el mes anterior es previo al registro del usuario, no hay con que comparar.
  previousPeriodNetSavings: number | null
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

export interface CategoryMonthlyTrendEntry {
  category: string
  monthlyTotals: number[]
}

export interface CategoryMonthlyTrend {
  months: string[]
  categories: CategoryMonthlyTrendEntry[]
}

// --- Pagina Analisis: series, comparativas, patrones y recomendaciones ---

export type AnalyticsGranularity = 'day' | 'week' | 'month'
export type AnalyticsCompareAgainst = 'previous' | 'year_ago' | 'average'

export interface TimelineBucket {
  /** Primer dia del periodo ('YYYY-MM-DD'): el dia, el lunes de la semana o el dia 1 del mes. */
  start: string
  totalIncome: number
  totalExpense: number
  net: number
  count: number
}

export interface Timeline {
  granularity: AnalyticsGranularity
  buckets: TimelineBucket[]
}

export interface CategoryComparison {
  category: string
  current: number
  previous: number
  /** null cuando no hay base de comparacion (el periodo anterior estaba en cero). */
  deltaPercent: number | null
}

export interface PeriodComparison {
  period: string
  against: AnalyticsCompareAgainst
  windowStart: string
  windowEnd: string
  elapsedDays: number
  daysInMonth: number
  currentTotal: number
  previousTotal: number
  deltaPercent: number | null
  categories: CategoryComparison[]
}

export interface HeatCell {
  day: string
  total: number
}

export interface WeekdayAverage {
  /** 0 = lunes ... 6 = domingo. */
  weekday: number
  average: number
}

export interface SpendingPatterns {
  firstDay: string
  lastDay: string
  weeks: number
  heat: HeatCell[]
  weekdayAverages: WeekdayAverage[]
  dailyAverage: number
  /** 0-1: proporcion del gasto que cae en sabado y domingo. */
  weekendShare: number
  busiestWeekday: number | null
  busiestDay: HeatCell | null
}

export interface WalletBreakdownItem {
  walletId: string
  name: string
  currency: string
  total: number
  percentage: number
  count: number
}

export interface TopTransaction {
  id: string
  occurredAt: string
  category: string
  description: string | null
  walletName: string
  amount: number
}

export type InsightLevel = 'alert' | 'warning' | 'info'

export interface Insight {
  code: string
  level: InsightLevel
  category: string | null
  amount: number | null
  referenceAmount: number | null
  percent: number | null
  weekday: number | null
}
