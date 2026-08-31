import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { convertAmount } from '../../../services/currency/currency.service'
import { useCurrency } from '../useCurrency'

vi.mock('../../../services/currency/currency.service', async () => {
  const actual = await vi.importActual<typeof import('../../../services/currency/currency.service')>(
    '../../../services/currency/currency.service',
  )
  return { ...actual, convertAmount: vi.fn() }
})

describe('useCurrency', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.mocked(convertAmount).mockReset()
  })

  it('expone isConverting en true mientras la conversion esta en vuelo', async () => {
    vi.mocked(convertAmount).mockResolvedValue({ convertedAmount: 18.5, rateUsed: 0.925 })
    const { isConverting, convert } = useCurrency()

    const promise = convert(20, 'USD', 'EUR')
    expect(isConverting.value).toBe(true)
    const result = await promise

    expect(isConverting.value).toBe(false)
    expect(result).toEqual({ convertedAmount: 18.5, rateUsed: 0.925 })
    expect(convertAmount).toHaveBeenCalledWith(20, 'USD', 'EUR')
  })

  it('guarda el mensaje en conversionError y re-lanza el error si falla', async () => {
    vi.mocked(convertAmount).mockRejectedValue(new Error('No se pudo convertir el monto.'))
    const { conversionError, isConverting, convert } = useCurrency()

    await expect(convert(20, 'USD', 'XXX')).rejects.toThrow('No se pudo convertir el monto.')

    expect(conversionError.value).toBe('No se pudo convertir el monto.')
    expect(isConverting.value).toBe(false)
  })

  it('limpia conversionError en una nueva llamada exitosa', async () => {
    vi.mocked(convertAmount).mockRejectedValueOnce(new Error('boom'))
    const { conversionError, convert } = useCurrency()
    await convert(20, 'USD', 'XXX').catch(() => {})
    expect(conversionError.value).toBe('boom')

    vi.mocked(convertAmount).mockResolvedValueOnce({ convertedAmount: 10, rateUsed: 1 })
    await convert(10, 'USD', 'EUR')

    expect(conversionError.value).toBeNull()
  })
})
