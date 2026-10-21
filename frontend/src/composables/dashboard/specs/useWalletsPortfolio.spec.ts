import { flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import * as currencyService from '../../../services/currency/currency.service'
import type { Wallet } from '../../../services/wallets/interfaces/wallets.interface'
import { useWalletsPortfolio } from '../useWalletsPortfolio'

function wallet(id: string, currency: string, balance: number): Wallet {
  return { id, name: id, currency, balance, createdAt: '2026-01-01T00:00:00Z' }
}

describe('useWalletsPortfolio', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('suma las wallets convertidas a la moneda activa y reparte el peso de cada una', async () => {
    vi.spyOn(currencyService, 'convertAmount').mockImplementation(async (amount, from) => ({
      convertedAmount: from === 'EUR' ? amount * 2 : amount,
      rateUsed: 1,
    }))
    const wallets = ref([wallet('a', 'USD', 300), wallet('b', 'EUR', 50)])

    const { total, shares } = useWalletsPortfolio(wallets, ref('USD'))
    await flushPromises()

    expect(total.value).toBe(400)
    expect(shares.value).toEqual({ a: 75, b: 25 })
  })

  it('una wallet cuya conversion falla cuenta como 0 y no rompe el total', async () => {
    vi.spyOn(currencyService, 'convertAmount').mockRejectedValue(new Error('sin tasa'))
    const wallets = ref([wallet('a', 'USD', 100), wallet('b', 'VEF', 999)])

    const { total, shares } = useWalletsPortfolio(wallets, ref('USD'))
    await flushPromises()

    expect(total.value).toBe(100)
    expect(shares.value).toEqual({ a: 100, b: 0 })
  })

  it('sin wallets deja el total en 0 y sin porcentajes', async () => {
    const { total, shares } = useWalletsPortfolio(ref([]), ref('USD'))
    await flushPromises()

    expect(total.value).toBe(0)
    expect(shares.value).toEqual({})
  })
})
