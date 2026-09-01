import { ref } from 'vue'
import {
  getCategoryBreakdown,
  getCategoryMonthlyTrend,
  getMonthlyComparison,
  getPeriodSummary,
} from '../../services/analytics/analytics.service'
import type {
  AnalyticsCategoryType,
  CategoryBreakdown,
  CategoryMonthlyTrend,
  MonthlyComparison,
  PeriodSummary,
} from '../../services/analytics/interfaces/analytics.interface'

// Envoltorio reactivo de services/analytics/analytics.service.ts, llamado
// desde AnalyticsMain.vue. Cada una de las 4 llamadas tiene su propio flag
// de loading (se piden en paralelo desde la pantalla, no tiene sentido un
// solo isLoading global que las mezcle a todas).
export function useAnalytics() {
  const periodSummary = ref<PeriodSummary | null>(null)
  const categoryBreakdown = ref<CategoryBreakdown[]>([])
  const monthlyComparison = ref<MonthlyComparison[]>([])
  const categoryTrend = ref<CategoryMonthlyTrend | null>(null)

  const isLoadingSummary = ref(false)
  const isLoadingCategories = ref(false)
  const isLoadingMonthly = ref(false)
  const isLoadingCategoryTrend = ref(false)

  const error = ref<string | null>(null)

  function toMessage(err: unknown, fallback: string): string {
    return err instanceof Error ? err.message : fallback
  }

  async function fetchPeriodSummary(month?: string): Promise<void> {
    isLoadingSummary.value = true
    error.value = null
    try {
      periodSummary.value = await getPeriodSummary(month)
    } catch (err) {
      error.value = toMessage(err, 'No se pudo obtener el resumen del período.')
    } finally {
      isLoadingSummary.value = false
    }
  }

  async function fetchCategoryBreakdown(type: AnalyticsCategoryType, month?: string): Promise<void> {
    isLoadingCategories.value = true
    error.value = null
    try {
      categoryBreakdown.value = await getCategoryBreakdown(type, month)
    } catch (err) {
      error.value = toMessage(err, 'No se pudo obtener el desglose por categoría.')
    } finally {
      isLoadingCategories.value = false
    }
  }

  async function fetchMonthlyComparison(months?: number): Promise<void> {
    isLoadingMonthly.value = true
    error.value = null
    try {
      monthlyComparison.value = await getMonthlyComparison(months)
    } catch (err) {
      error.value = toMessage(err, 'No se pudo obtener la comparación mensual.')
    } finally {
      isLoadingMonthly.value = false
    }
  }

  async function fetchCategoryTrend(type: AnalyticsCategoryType, months?: number): Promise<void> {
    isLoadingCategoryTrend.value = true
    error.value = null
    try {
      categoryTrend.value = await getCategoryMonthlyTrend(type, months)
    } catch (err) {
      error.value = toMessage(err, 'No se pudo obtener la tendencia por categoría.')
    } finally {
      isLoadingCategoryTrend.value = false
    }
  }

  return {
    periodSummary,
    categoryBreakdown,
    monthlyComparison,
    categoryTrend,
    isLoadingSummary,
    isLoadingCategories,
    isLoadingMonthly,
    isLoadingCategoryTrend,
    error,
    fetchPeriodSummary,
    fetchCategoryBreakdown,
    fetchMonthlyComparison,
    fetchCategoryTrend,
  }
}
