import { ref } from 'vue'
import { getCategoryBreakdown, getMonthlyComparison, getPeriodSummary } from '../../services/analytics/analytics.service'
import type {
  AnalyticsCategoryType,
  CategoryBreakdown,
  MonthlyComparison,
  PeriodSummary,
} from '../../services/analytics/interfaces/analytics.interface'

// Envoltorio reactivo de services/analytics/analytics.service.ts, llamado
// desde AnalyticsMain.vue. Cada una de las 3 llamadas tiene su propio flag
// de loading (se piden en paralelo desde la pantalla, no tiene sentido un
// solo isLoading global que las mezcle a todas).
export function useAnalytics() {
  const periodSummary = ref<PeriodSummary | null>(null)
  const categoryBreakdown = ref<CategoryBreakdown[]>([])
  const monthlyComparison = ref<MonthlyComparison[]>([])

  const isLoadingSummary = ref(false)
  const isLoadingCategories = ref(false)
  const isLoadingMonthly = ref(false)

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

  return {
    periodSummary,
    categoryBreakdown,
    monthlyComparison,
    isLoadingSummary,
    isLoadingCategories,
    isLoadingMonthly,
    error,
    fetchPeriodSummary,
    fetchCategoryBreakdown,
    fetchMonthlyComparison,
  }
}
