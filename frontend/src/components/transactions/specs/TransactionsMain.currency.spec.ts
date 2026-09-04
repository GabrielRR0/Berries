import { createPinia, setActivePinia } from 'pinia'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as currencyService from '../../../services/currency/currency.service'
import * as transactionsService from '../../../services/transactions/transactions.service'
import * as walletsService from '../../../services/wallets/wallets.service'
import { useCurrencyStore } from '../../../stores/currency.store'
import TransactionsMain from '../TransactionsMain.vue'

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

const now = new Date()
function thisMonthDate(day: number): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}T12:00:00Z`
}

const USD_WALLET = { id: 'wallet-usd', name: 'Facebank', currency: 'USD', balance: 100, createdAt: thisMonthDate(1) }
const VEF_WALLET = { id: 'wallet-vef', name: 'Banco Vnz', currency: 'VEF', balance: 100, createdAt: thisMonthDate(1) }

// Bug real reportado por el usuario, con captura: las boxes de Ingresos/Gastos de
// Movimientos (a diferencia de las de Inicio, ya arregladas antes) sumaban el monto
// crudo de cada movimiento sin convertir - un gasto de 31.187 VEF aparecía como
// "31.187,00 €" apenas la moneda de visualización activa era EUR. Una Transaction no
// trae su propia moneda (solo wallet_id): hay que resolverla por su wallet y convertir
// antes de sumar (ver walletCurrency/sumConverted en TransactionsMain.vue).
describe('TransactionsMain - conversión de moneda en las boxes de Ingresos/Gastos', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.spyOn(transactionsService, 'listDrafts').mockResolvedValue([])
    vi.spyOn(walletsService, 'listWallets').mockResolvedValue([USD_WALLET, VEF_WALLET])
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('convierte los gastos de una wallet en otra moneda antes de sumarlos, en vez de sumar el monto crudo', async () => {
    vi.spyOn(transactionsService, 'listTransactions').mockResolvedValue([
      {
        id: 'tx-1',
        walletId: VEF_WALLET.id,
        type: 'expense',
        amount: 4082,
        category: 'Mercado',
        description: null,
        occurredAt: thisMonthDate(5),
        source: 'manual',
        transferId: null,
        referenceAmountUsd: null,
        createdAt: thisMonthDate(5),
      },
      {
        id: 'tx-2',
        walletId: USD_WALLET.id,
        type: 'expense',
        amount: 40,
        category: 'Transporte',
        description: null,
        occurredAt: thisMonthDate(7),
        source: 'manual',
        transferId: null,
        referenceAmountUsd: null,
        createdAt: thisMonthDate(7),
      },
    ])
    // 4082 VEF -> 5.10 USD (tasa ficticia del test) + 40 USD directos = 45.10 USD.
    vi.spyOn(currencyService, 'convertAmount').mockImplementation(async (amount, from, to) => {
      if (from === 'VEF' && to === 'USD') return { convertedAmount: amount / 800, rateUsed: 1 / 800 }
      throw new Error(`conversión no mockeada: ${from} -> ${to}`)
    })
    useCurrencyStore().setDisplayCurrency('USD')

    const wrapper = mount(TransactionsMain)
    await flushPromises()
    await flushPromises() // deja resolver el recompute async encadenado (convert -> sum)

    const amounts = wrapper.findAll('.summary-amount').map((el) => el.text())
    // 4082/800 + 40 = 5.1025 + 40 = 45.1025 -> nunca 4082 + 40 = 4122 (el bug real).
    expect(amounts.some((text) => /45\.10/.test(text))).toBe(true)
    expect(amounts.some((text) => text.includes('4122') || text.includes('4,122'))).toBe(false)
  })

  it('no mezcla monedas: una wallet en la MISMA moneda que el display no pasa por convert()', async () => {
    vi.spyOn(transactionsService, 'listTransactions').mockResolvedValue([
      {
        id: 'tx-1',
        walletId: USD_WALLET.id,
        type: 'income',
        amount: 1000,
        category: 'Salario',
        description: null,
        occurredAt: thisMonthDate(2),
        source: 'manual',
        transferId: null,
        referenceAmountUsd: null,
        createdAt: thisMonthDate(2),
      },
    ])
    const convertSpy = vi.spyOn(currencyService, 'convertAmount')
    useCurrencyStore().setDisplayCurrency('USD')

    const wrapper = mount(TransactionsMain)
    await flushPromises()
    await flushPromises()

    expect(convertSpy).not.toHaveBeenCalled()
    const amounts = wrapper.findAll('.summary-amount').map((el) => el.text())
    expect(amounts.some((text) => /1,000\.00|1000/.test(text))).toBe(true)
  })
})
