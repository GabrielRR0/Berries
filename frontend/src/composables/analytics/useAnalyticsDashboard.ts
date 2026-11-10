import { computed, watch } from 'vue'
import {
  getCategoryBreakdown,
  getCategoryMonthlyTrend,
  getPeriodSummary,
} from '../../services/analytics/analytics.service'
import {
  getInsights,
  getPeriodComparison,
  getSpendingPatterns,
  getTimeline,
  getTopTransactions,
  getWalletBreakdown,
} from '../../services/analytics/dashboard.service'
import type {
  CategoryBreakdown,
  CategoryMonthlyTrend,
  Insight,
  PeriodComparison,
  PeriodSummary,
  SpendingPatterns,
  Timeline,
  TopTransaction,
  WalletBreakdownItem,
} from '../../services/analytics/interfaces/analytics.interface'
import { historyRange, timelineRange } from '../../utils/analytics/periods'
import type { AnalyticsFilters } from './useAnalyticsFilters'
import { useKeyedResource } from './useKeyedResource'

// Pide todo lo que muestra la pagina Analisis y lo mantiene al dia segun los filtros. Cada
// bloque tiene su propio estado de carga y su propia clave de cache, asi cambiar la
// granularidad solo vuelve a pedir el grafico de flujo, y cambiar de mes pide lo del mes.
const TREND_MONTHS = 6

export function useAnalyticsDashboard(filters: AnalyticsFilters) {
  const summary = useKeyedResource<PeriodSummary>()
  const flow = useKeyedResource<Timeline>()
  const history = useKeyedResource<Timeline>()
  const comparison = useKeyedResource<PeriodComparison>()
  const categories = useKeyedResource<CategoryBreakdown[]>()
  const trend = useKeyedResource<CategoryMonthlyTrend>()
  const patterns = useKeyedResource<SpendingPatterns>()
  const wallets = useKeyedResource<WalletBreakdownItem[]>()
  const top = useKeyedResource<TopTransaction[]>()
  const insights = useKeyedResource<Insight[]>()

  function loadMonthData(force = false) {
    const key = filters.monthKey.value
    const history6 = historyRange(filters.year.value, filters.month.value)
    const options = { force }
    summary.load(`summary:${key}`, () => getPeriodSummary(key), options)
    history.load(`history:${key}`, () => getTimeline('month', history6.dateFrom, history6.dateTo), options)
    categories.load(`categories:${key}`, () => getCategoryBreakdown('expense', key), options)
    wallets.load(`wallets:${key}`, () => getWalletBreakdown(key), options)
    top.load(`top:${key}`, () => getTopTransactions(key, 5), options)
    insights.load(`insights:${key}`, () => getInsights(key), options)
  }

  function loadComparison(force = false) {
    const key = filters.monthKey.value
    const against = filters.against.value
    comparison.load(`compare:${key}:${against}`, () => getPeriodComparison(key, against), { force })
  }

  function loadFlow(force = false) {
    const { granularity, year, month, walletId, monthKey } = filters
    const range = timelineRange(granularity.value, year.value, month.value)
    const wallet = walletId.value ?? undefined
    flow.load(
      `flow:${granularity.value}:${monthKey.value}:${wallet ?? 'all'}`,
      () => getTimeline(granularity.value, range.dateFrom, range.dateTo, wallet),
      { force },
    )
  }

  function loadStatic(force = false) {
    patterns.load('patterns', () => getSpendingPatterns(8), { force })
    trend.load(`trend:${TREND_MONTHS}`, () => getCategoryMonthlyTrend('expense', TREND_MONTHS), { force })
  }

  watch(filters.monthKey, () => loadMonthData(), { immediate: true })
  watch([filters.monthKey, filters.against], () => loadComparison(), { immediate: true })
  watch([filters.monthKey, filters.granularity, filters.walletId], () => loadFlow(), { immediate: true })
  loadStatic()

  function reload() {
    loadMonthData(true)
    loadComparison(true)
    loadFlow(true)
    loadStatic(true)
  }

  const error = computed(
    () =>
      [summary, flow, history, comparison, categories, trend, patterns, wallets, top, insights]
        .map((resource) => resource.error.value)
        .find((message) => message !== null) ?? null,
  )

  return { summary, flow, history, comparison, categories, trend, patterns, wallets, top, insights, error, reload }
}
