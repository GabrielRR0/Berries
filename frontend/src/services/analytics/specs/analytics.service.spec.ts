import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  AnalyticsApiError,
  getCategoryBreakdown,
  getCategoryMonthlyTrend,
  getMonthlyComparison,
  getPeriodSummary,
} from '../analytics.service'

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

    // FastAPI/Pydantic serializa Decimal como string en el JSON, no como
    // number - bug real ya encontrado en goals.service.ts/debts.service.ts,
    // se cubre igual aca.
    it('convierte montos Decimal que llegan como string a number', async () => {
      vi.mocked(fetch).mockResolvedValue(
        mockResponse({
          period: '2026-08',
          total_income: '1200.00',
          total_expense: '800.00',
          net_savings: '400.00',
          previous_period_net_savings: '250.00',
        }),
      )

      const result = await getPeriodSummary('2026-08')

      expect(result).toEqual({
        period: '2026-08',
        totalIncome: 1200,
        totalExpense: 800,
        netSavings: 400,
        previousPeriodNetSavings: 250,
      })
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

  describe('getCategoryMonthlyTrend', () => {
    const TREND_WIRE = {
      months: ['2026-07', '2026-08'],
      categories: [
        { category: 'Mercado', monthly_totals: ['80.00', '120.00'] },
        { category: 'Otros', monthly_totals: ['10.00', '5.00'] },
      ],
    }

    it('manda el type requerido como query param', async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse(TREND_WIRE))

      await getCategoryMonthlyTrend('expense')

      const [url, init] = vi.mocked(fetch).mock.calls[0]
      expect(url).toBe('/api/analytics/categories/trend?type=expense')
      expect(init!.headers).toEqual({ Authorization: 'Bearer jwt-token' })
    })

    it('incluye months cuando se da, junto al type', async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse(TREND_WIRE))

      await getCategoryMonthlyTrend('expense', 6)

      const [url] = vi.mocked(fetch).mock.calls[0]
      expect(url).toBe('/api/analytics/categories/trend?type=expense&months=6')
    })

    it('mapea meses y totales (Decimal-como-string) a camelCase/number', async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse(TREND_WIRE))

      const result = await getCategoryMonthlyTrend('expense', 2)

      expect(result).toEqual({
        months: ['2026-07', '2026-08'],
        categories: [
          { category: 'Mercado', monthlyTotals: [80, 120] },
          { category: 'Otros', monthlyTotals: [10, 5] },
        ],
      })
    })

    it('lanza AnalyticsApiError en error del servidor', async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse({ detail: 'Error interno.' }, { ok: false, status: 500 }))

      const error: unknown = await getCategoryMonthlyTrend('expense').catch((e: unknown) => e)

      expect(error).toBeInstanceOf(AnalyticsApiError)
    })
  })
})
