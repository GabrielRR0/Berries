import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getCategoryBreakdown, getMonthlyComparison, getPeriodSummary } from '../../../services/analytics/analytics.service'
import type {
  CategoryBreakdown,
  MonthlyComparison,
  PeriodSummary,
} from '../../../services/analytics/interfaces/analytics.interface'
import { useAnalytics } from '../useAnalytics'

vi.mock('../../../services/analytics/analytics.service', () => ({
  getPeriodSummary: vi.fn(),
  getCategoryBreakdown: vi.fn(),
  getMonthlyComparison: vi.fn(),
}))

const PERIOD_SUMMARY: PeriodSummary = {
  period: '2026-08',
  totalIncome: 1200,
  totalExpense: 800,
  netSavings: 400,
  previousPeriodNetSavings: 250,
}

const CATEGORIES: CategoryBreakdown[] = [{ category: 'Comida', total: 300, percentage: 100 }]

const MONTHLY: MonthlyComparison[] = [{ month: '2026-08', totalIncome: 1200, totalExpense: 800, net: 400 }]

describe('useAnalytics', () => {
  beforeEach(() => {
    vi.mocked(getPeriodSummary).mockReset().mockResolvedValue(PERIOD_SUMMARY)
    vi.mocked(getCategoryBreakdown).mockReset().mockResolvedValue(CATEGORIES)
    vi.mocked(getMonthlyComparison).mockReset().mockResolvedValue(MONTHLY)
  })

  it('arranca vacio, sin cargar y sin error', () => {
    const { periodSummary, categoryBreakdown, monthlyComparison, isLoadingSummary, isLoadingCategories, isLoadingMonthly, error } =
      useAnalytics()

    expect(periodSummary.value).toBeNull()
    expect(categoryBreakdown.value).toEqual([])
    expect(monthlyComparison.value).toEqual([])
    expect(isLoadingSummary.value).toBe(false)
    expect(isLoadingCategories.value).toBe(false)
    expect(isLoadingMonthly.value).toBe(false)
    expect(error.value).toBeNull()
  })

  describe('fetchPeriodSummary', () => {
    it('pide el resumen del mes, pasando isLoadingSummary por true y de vuelta a false', async () => {
      const { periodSummary, isLoadingSummary, fetchPeriodSummary } = useAnalytics()

      const promise = fetchPeriodSummary('2026-08')
      expect(isLoadingSummary.value).toBe(true)
      await promise

      expect(getPeriodSummary).toHaveBeenCalledWith('2026-08')
      expect(periodSummary.value).toEqual(PERIOD_SUMMARY)
      expect(isLoadingSummary.value).toBe(false)
    })

    it('guarda el mensaje de error si el servicio falla', async () => {
      vi.mocked(getPeriodSummary).mockRejectedValue(new Error('fallo de red'))
      const { error, fetchPeriodSummary } = useAnalytics()

      await fetchPeriodSummary()

      expect(error.value).toBe('fallo de red')
    })
  })

  describe('fetchCategoryBreakdown', () => {
    it('pide el desglose por categoría con el type y month dados', async () => {
      const { categoryBreakdown, fetchCategoryBreakdown } = useAnalytics()

      await fetchCategoryBreakdown('expense', '2026-08')

      expect(getCategoryBreakdown).toHaveBeenCalledWith('expense', '2026-08')
      expect(categoryBreakdown.value).toEqual(CATEGORIES)
    })

    it('guarda el mensaje de error si el servicio falla', async () => {
      vi.mocked(getCategoryBreakdown).mockRejectedValue(new Error('categoría inválida'))
      const { error, fetchCategoryBreakdown } = useAnalytics()

      await fetchCategoryBreakdown('income')

      expect(error.value).toBe('categoría inválida')
    })
  })

  describe('fetchMonthlyComparison', () => {
    it('pide la comparación mensual con el número de meses dado', async () => {
      const { monthlyComparison, fetchMonthlyComparison } = useAnalytics()

      await fetchMonthlyComparison(6)

      expect(getMonthlyComparison).toHaveBeenCalledWith(6)
      expect(monthlyComparison.value).toEqual(MONTHLY)
    })

    it('guarda el mensaje de error si el servicio falla', async () => {
      vi.mocked(getMonthlyComparison).mockRejectedValue(new Error('fallo de red'))
      const { error, fetchMonthlyComparison } = useAnalytics()

      await fetchMonthlyComparison()

      expect(error.value).toBe('fallo de red')
    })
  })
})
