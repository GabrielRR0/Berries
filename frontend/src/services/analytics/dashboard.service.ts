// Llamadas de la pagina Analisis que van mas alla del resumen mensual: series por
// dia/semana/mes, comparativas, patrones, billeteras, mayores gastos y
// recomendaciones. Mismo patron que analytics.service.ts (fetch plano, snake_case ->
// camelCase, Decimal que viaja como string -> Number).

import {
  AnalyticsApiError,
  API_BASE_URL,
  authHeaders,
  parseErrorMessage,
} from './analytics.service'
import type {
  AnalyticsCompareAgainst,
  AnalyticsGranularity,
  CategoryComparison,
  HeatCell,
  Insight,
  InsightLevel,
  PeriodComparison,
  SpendingPatterns,
  Timeline,
  TimelineBucket,
  TopTransaction,
  WalletBreakdownItem,
  WeekdayAverage,
} from './interfaces/analytics.interface'

type Decimal = number | string

interface TimelineBucketWire {
  start: string
  total_income: Decimal
  total_expense: Decimal
  net: Decimal
  count: number
}
interface CategoryComparisonWire {
  category: string
  current: Decimal
  previous: Decimal
  delta_percent: number | null
}
interface PeriodComparisonWire {
  period: string
  against: AnalyticsCompareAgainst
  window_start: string
  window_end: string
  elapsed_days: number
  days_in_month: number
  current_total: Decimal
  previous_total: Decimal
  delta_percent: number | null
  categories: CategoryComparisonWire[]
}
interface HeatCellWire {
  day: string
  total: Decimal
}
interface SpendingPatternsWire {
  first_day: string
  last_day: string
  weeks: number
  heat: HeatCellWire[]
  weekday_averages: { weekday: number; average: Decimal }[]
  daily_average: Decimal
  weekend_share: number
  busiest_weekday: number | null
  busiest_day: HeatCellWire | null
}
interface WalletBreakdownWire {
  wallet_id: string
  name: string
  currency: string
  total: Decimal
  percentage: number
  count: number
}
interface TopTransactionWire {
  id: string
  occurred_at: string
  category: string
  description: string | null
  wallet_name: string
  amount: Decimal
}
interface InsightWire {
  code: string
  level: InsightLevel
  category: string | null
  amount: Decimal | null
  reference_amount: Decimal | null
  percent: number | null
  weekday: number | null
}

const toNumberOrNull = (value: Decimal | null): number | null => (value === null ? null : Number(value))

function mapBucket(wire: TimelineBucketWire): TimelineBucket {
  return {
    start: wire.start,
    totalIncome: Number(wire.total_income),
    totalExpense: Number(wire.total_expense),
    net: Number(wire.net),
    count: wire.count,
  }
}

function mapCategoryComparison(wire: CategoryComparisonWire): CategoryComparison {
  return {
    category: wire.category,
    current: Number(wire.current),
    previous: Number(wire.previous),
    deltaPercent: wire.delta_percent,
  }
}

function mapHeatCell(wire: HeatCellWire): HeatCell {
  return { day: wire.day, total: Number(wire.total) }
}

async function getJson<T>(path: string, params: Record<string, string | number | undefined>, fallback: string): Promise<T> {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) query.set(key, String(value))
  }
  const suffix = query.toString() ? `?${query.toString()}` : ''
  const response = await fetch(`${API_BASE_URL}/api/analytics/${path}${suffix}`, { headers: { ...authHeaders() } })
  if (!response.ok) throw new AnalyticsApiError(await parseErrorMessage(response, fallback), response.status)
  return (await response.json()) as T
}

export async function getTimeline(
  granularity: AnalyticsGranularity,
  dateFrom: string,
  dateTo: string,
  walletId?: string,
): Promise<Timeline> {
  const wire = await getJson<{ granularity: AnalyticsGranularity; buckets: TimelineBucketWire[] }>(
    'timeline',
    { granularity, date_from: dateFrom, date_to: dateTo, wallet_id: walletId },
    'No se pudo obtener la evolución de tus movimientos.',
  )
  return { granularity: wire.granularity, buckets: wire.buckets.map(mapBucket) }
}

export async function getPeriodComparison(month: string, against: AnalyticsCompareAgainst): Promise<PeriodComparison> {
  const wire = await getJson<PeriodComparisonWire>('compare', { month, against }, 'No se pudo obtener la comparación.')
  return {
    period: wire.period,
    against: wire.against,
    windowStart: wire.window_start,
    windowEnd: wire.window_end,
    elapsedDays: wire.elapsed_days,
    daysInMonth: wire.days_in_month,
    currentTotal: Number(wire.current_total),
    previousTotal: Number(wire.previous_total),
    deltaPercent: wire.delta_percent,
    categories: wire.categories.map(mapCategoryComparison),
  }
}

export async function getSpendingPatterns(weeks = 8): Promise<SpendingPatterns> {
  const wire = await getJson<SpendingPatternsWire>('patterns', { weeks }, 'No se pudieron obtener tus patrones de gasto.')
  const averages: WeekdayAverage[] = wire.weekday_averages.map((item) => ({
    weekday: item.weekday,
    average: Number(item.average),
  }))
  return {
    firstDay: wire.first_day,
    lastDay: wire.last_day,
    weeks: wire.weeks,
    heat: wire.heat.map(mapHeatCell),
    weekdayAverages: averages,
    dailyAverage: Number(wire.daily_average),
    weekendShare: wire.weekend_share,
    busiestWeekday: wire.busiest_weekday,
    busiestDay: wire.busiest_day ? mapHeatCell(wire.busiest_day) : null,
  }
}

export async function getWalletBreakdown(month: string): Promise<WalletBreakdownItem[]> {
  const wire = await getJson<WalletBreakdownWire[]>('wallets', { month, type: 'expense' }, 'No se pudo obtener el gasto por billetera.')
  return wire.map((item) => ({
    walletId: item.wallet_id,
    name: item.name,
    currency: item.currency,
    total: Number(item.total),
    percentage: item.percentage,
    count: item.count,
  }))
}

export async function getTopTransactions(month: string, limit = 5): Promise<TopTransaction[]> {
  const wire = await getJson<TopTransactionWire[]>(
    'top-transactions',
    { month, type: 'expense', limit },
    'No se pudieron obtener tus mayores gastos.',
  )
  return wire.map((item) => ({
    id: item.id,
    occurredAt: item.occurred_at,
    category: item.category,
    description: item.description,
    walletName: item.wallet_name,
    amount: Number(item.amount),
  }))
}

export async function getInsights(month: string): Promise<Insight[]> {
  const wire = await getJson<InsightWire[]>('insights', { month }, 'No se pudieron calcular las recomendaciones.')
  return wire.map((item) => ({
    code: item.code,
    level: item.level,
    category: item.category,
    amount: toNumberOrNull(item.amount),
    referenceAmount: toNumberOrNull(item.reference_amount),
    percent: item.percent,
    weekday: item.weekday,
  }))
}
