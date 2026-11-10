import { computed, ref } from 'vue'
import type {
  AnalyticsCompareAgainst,
  AnalyticsGranularity,
} from '../../services/analytics/interfaces/analytics.interface'
import { toPeriodKey } from '../../utils/formatters/formatPeriod'

// Lo que el usuario elige arriba en Analisis: mes, granularidad del grafico de flujo,
// contra que comparar, billetera y categoria resaltada. El mes arranca en el actual.
export function useAnalyticsFilters() {
  const today = new Date()
  const year = ref(today.getFullYear())
  const month = ref(today.getMonth())
  const granularity = ref<AnalyticsGranularity>('day')
  const against = ref<AnalyticsCompareAgainst>('previous')
  const walletId = ref<string | null>(null)
  const selectedCategory = ref<string | null>(null)

  const monthKey = computed(() => toPeriodKey(year.value, month.value))

  function setMonth(nextYear: number, nextMonth: number) {
    year.value = nextYear
    month.value = nextMonth
    selectedCategory.value = null
  }

  function toggleCategory(category: string) {
    selectedCategory.value = selectedCategory.value === category ? null : category
  }

  return { year, month, granularity, against, walletId, selectedCategory, monthKey, setMonth, toggleCategory }
}

export type AnalyticsFilters = ReturnType<typeof useAnalyticsFilters>
