import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '../../../stores/auth.store'
import { CurrencyApiError, convertAmount } from '../currency.service'

function mockResponse(body: unknown, init: { ok?: boolean; status?: number } = {}): Response {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    json: async () => body,
  } as unknown as Response
}

describe('currency.service', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    useAuthStore().token = 'jwt-token'
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('convertAmount', () => {
    it('pide GET /api/currency/convert con amount/from/to como query params y Authorization', async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse({ converted_amount: '18.5', rate_used: '0.925' }))

      await convertAmount(20, 'USD', 'EUR')

      const [url, init] = vi.mocked(fetch).mock.calls[0]
      expect(url).toBe('/api/currency/convert?amount=20&from=USD&to=EUR')
      expect(init!.headers).toEqual({ Authorization: 'Bearer jwt-token' })
    })

    it('mapea converted_amount/rate_used (string) a camelCase number', async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse({ converted_amount: '18.5', rate_used: '0.925' }))

      const result = await convertAmount(20, 'USD', 'EUR')

      expect(result).toEqual({ convertedAmount: 18.5, rateUsed: 0.925 })
    })

    it('tambien mapea correctamente cuando el backend manda numbers en vez de strings', async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse({ converted_amount: 18.5, rate_used: 0.925 }))

      const result = await convertAmount(20, 'USD', 'EUR')

      expect(result).toEqual({ convertedAmount: 18.5, rateUsed: 0.925 })
    })

    it('lanza CurrencyApiError con el status y detail del backend', async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse({ detail: 'Moneda no soportada.' }, { ok: false, status: 400 }))

      const error: unknown = await convertAmount(20, 'USD', 'XXX').catch((e: unknown) => e)

      expect(error).toBeInstanceOf(CurrencyApiError)
      expect((error as CurrencyApiError).status).toBe(400)
      expect((error as CurrencyApiError).message).toBe('Moneda no soportada.')
    })
  })
})
