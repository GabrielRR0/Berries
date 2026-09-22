import { createPinia, setActivePinia } from 'pinia'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as analyticsService from '../../../services/analytics/analytics.service'
import * as transactionsService from '../../../services/transactions/transactions.service'
import * as walletsService from '../../../services/wallets/wallets.service'
import type { AuthUser } from '../../../services/auth/interfaces/auth.interface'
import { useAuthStore } from '../../../stores/auth.store'
import MonthPager from '../../ui/MonthPager.vue'
import TransactionsMain from '../TransactionsMain.vue'

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

const now = new Date()
const CURRENT_PERIOD = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

const USD_WALLET = { id: 'wallet-usd', name: 'Facebank', currency: 'USD', balance: 100, createdAt: '2026-08-01T00:00:00Z' }

function periodSummary(totalIncome: number, totalExpense: number) {
  return {
    period: CURRENT_PERIOD,
    totalIncome,
    totalExpense,
    netSavings: totalIncome - totalExpense,
    previousPeriodNetSavings: 0,
  }
}

// Bug real reportado por el usuario, con captura: las boxes de Ingresos/Gastos de
// Movimientos (a diferencia de las de Inicio, ya arregladas antes) recalculaban su
// propio total agrupando por moneda y convirtiendo con la tasa EN VIVO - un camino
// totalmente distinto al que ya usa Análisis (get_period_summary, tasa histórica
// congelada por transacción). Ahora Movimientos simplemente pide el mismo resumen que
// Análisis, para el mes activo del pager, en vez de reimplementar su propia suma.
describe('TransactionsMain - boxes de Ingresos/Gastos usan el mismo resumen que Análisis', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.spyOn(transactionsService, 'listDrafts').mockResolvedValue([])
    vi.spyOn(transactionsService, 'listTransactions').mockResolvedValue([])
    vi.spyOn(walletsService, 'listWallets').mockResolvedValue([USD_WALLET])
    useAuthStore().user = {
      id: 'user-1',
      email: 'ana@example.com',
      displayName: 'Ana',
      defaultCurrency: 'USD',
      createdAt: '2026-08-01T00:00:00Z',
    } satisfies AuthUser
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('pide getPeriodSummary con el mes activo del pager y muestra sus totales', async () => {
    const getPeriodSummarySpy = vi
      .spyOn(analyticsService, 'getPeriodSummary')
      .mockResolvedValue(periodSummary(1000, 45.1))

    const wrapper = mount(TransactionsMain)
    await flushPromises()

    expect(getPeriodSummarySpy).toHaveBeenCalledWith(CURRENT_PERIOD)
    const amounts = wrapper.findAll('.summary-amount').map((el) => el.text())
    expect(amounts.some((text) => /1,000|1000/.test(text))).toBe(true)
    expect(amounts.some((text) => /45\.10/.test(text))).toBe(true)
  })

  it('vuelve a pedir el resumen al cambiar de mes con el pager', async () => {
    const getPeriodSummarySpy = vi.spyOn(analyticsService, 'getPeriodSummary').mockResolvedValue(periodSummary(0, 0))

    const wrapper = mount(TransactionsMain)
    await flushPromises()
    getPeriodSummarySpy.mockClear()

    await wrapper.findComponent(MonthPager).vm.$emit('change', now.getFullYear(), now.getMonth() - 1)
    await flushPromises()

    const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const previousPeriod = `${previousMonth.getFullYear()}-${String(previousMonth.getMonth() + 1).padStart(2, '0')}`
    expect(getPeriodSummarySpy).toHaveBeenCalledWith(previousPeriod)
  })
})
