import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AnalyticsApiError, getCategoryBreakdown, getMonthlyComparison, getPeriodSummary } from '../analytics.service'

function mockResponse(body: unknown, init: { ok?: boolean; status?: number } = {}): Response {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    json: async () => body,
  } as unknown as Response
}

const PERIOD_SUMMARY_WIRE = {
  period: '2026-08',
  total_income: 1200,
  total_expense: 800,
  net_savings: 400,
  previous_period_net_savings: 250,
}

const CATEGORY_WIRE = [
  { category: 'Comida', total: 300, percentage: 60 },
  { category: 'Transporte', total: 200, percentage: 40 },
]

const MONTHLY_WIRE = [
  { month: '2026-03', total_income: 1000, total_expense: 700, net: 300 },
  { month: '2026-04', total_income: 1100, total_expense: 900, net: 200 },
]

describe('analytics.service', () => {
  beforeEach(() => {
    localStorage.clear()
    localStorage.setItem('berry_auth_token', 'jwt-token')
    setActivePinia(createPinia())
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('getPeriodSummary', () => {
    it('sin month, no manda query param', async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse(PERIOD_SUMMARY_WIRE))

      await getPeriodSummary()

      const [url, init] = vi.mocked(fetch).mock.calls[0]
      expect(url).toBe('/api/analytics/summary')
      expect(init!.headers).toEqual({ Authorization: 'Bearer jwt-token' })
    })

    it('con month, lo manda como query param', async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse(PERIOD_SUMMARY_WIRE))

      await getPeriodSummary('2026-08')

      const [url] = vi.mocked(fetch).mock.calls[0]
      expect(url).toBe('/api/analytics/summary?month=2026-08')
    })

    it('mapea la respuesta snake_case a camelCase', async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse(PERIOD_SUMMARY_WIRE))

      const result = await getPeriodSummary('2026-08')

      expect(result).toEqual({
        period: '2026-08',
        totalIncome: 1200,
        totalExpense: 800,
        netSavings: 400,
        previousPeriodNetSavings: 250,
      })
    })

    it('lanza AnalyticsApiError con el status y el detail del backend en error', async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse({ detail: 'Mes inválido.' }, { ok: false, status: 400 }))

      const error: unknown = await getPeriodSummary('mal-formado').catch((e: unknown) => e)

      expect(error).toBeInstanceOf(AnalyticsApiError)
      expect((error as AnalyticsApiError).status).toBe(400)
      expect((error as AnalyticsApiError).message).toBe('Mes inválido.')
    })
  })

  describe('getCategoryBreakdown', () => {
    it('manda el type requerido como query param', async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse(CATEGORY_WIRE))

      await getCategoryBreakdown('expense')

      const [url, init] = vi.mocked(fetch).mock.calls[0]
      expect(url).toBe('/api/analytics/categories?type=expense')
      expect(init!.headers).toEqual({ Authorization: 'Bearer jwt-token' })
    })

    it('incluye month cuando se da, junto al type', async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse(CATEGORY_WIRE))

      await getCategoryBreakdown('income', '2026-08')

      const [url] = vi.mocked(fetch).mock.calls[0]
      expect(url).toBe('/api/analytics/categories?type=income&month=2026-08')
    })

    it('mapea la lista completa a camelCase, ordenada como llega del backend', async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse(CATEGORY_WIRE))

      const result = await getCategoryBreakdown('expense')

      expect(result).toEqual([
        { category: 'Comida', total: 300, percentage: 60 },
        { category: 'Transporte', total: 200, percentage: 40 },
      ])
    })

    it('lanza AnalyticsApiError en error del servidor', async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse({ detail: 'Error interno.' }, { ok: false, status: 500 }))

      const error: unknown = await getCategoryBreakdown('expense').catch((e: unknown) => e)

      expect(error).toBeInstanceOf(AnalyticsApiError)
      expect((error as AnalyticsApiError).status).toBe(500)
    })
  })

  describe('getMonthlyComparison', () => {
    it('sin months, no manda query param', async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse(MONTHLY_WIRE))

      await getMonthlyComparison()

      const [url] = vi.mocked(fetch).mock.calls[0]
      expect(url).toBe('/api/analytics/monthly')
    })

    it('con months, lo manda como query param', async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse(MONTHLY_WIRE))

      await getMonthlyComparison(6)

      const [url] = vi.mocked(fetch).mock.calls[0]
      expect(url).toBe('/api/analytics/monthly?months=6')
    })

    it('mapea la lista completa a camelCase', async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse(MONTHLY_WIRE))

      const result = await getMonthlyComparison(6)

      expect(result).toEqual([
        { month: '2026-03', totalIncome: 1000, totalExpense: 700, net: 300 },
        { month: '2026-04', totalIncome: 1100, totalExpense: 900, net: 200 },
      ])
    })

    it('lanza AnalyticsApiError en error del servidor', async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse({ detail: 'Error interno.' }, { ok: false, status: 500 }))

      const error: unknown = await getMonthlyComparison().catch((e: unknown) => e)

      expect(error).toBeInstanceOf(AnalyticsApiError)
    })
  })
})
