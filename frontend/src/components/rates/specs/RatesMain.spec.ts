import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as currencyService from '../../../services/currency/currency.service'
import RatesMain from '../RatesMain.vue'

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

function historyResult(code: string, quote: string, points: { rate: number; isEstimated?: boolean }[]) {
  return {
    code,
    quote,
    points: points.map((point, index) => ({
      fetchedAt: `2026-0${index + 1}-01T00:00:00Z`,
      rate: point.rate,
      source: point.isEstimated ? 'fallback-stale' : 'dolarapi-oficial',
      isEstimated: point.isEstimated ?? false,
    })),
  }
}

// Por default, ningún test tiene datos de "tus transferencias" (against=USDT vacío) -
// solo los tests que prueban esa pestaña la pueblan explícitamente.
function mockDefaultHistory(officialPoints: { rate: number; isEstimated?: boolean }[] = [{ rate: 700 }, { rate: 800 }]) {
  vi.spyOn(currencyService, 'getRateHistory').mockImplementation(async (code, _months, against = 'USD') => {
    if (against === 'USDT') return historyResult(code, 'USDT', [])
    return historyResult(code, 'USD', officialPoints)
  })
}

describe('RatesMain', () => {
  beforeEach(() => {
    mockDefaultHistory()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('al montar pide el historial oficial de la primera moneda nacional (VEF) con la ventana de 6 meses por default', async () => {
    mount(RatesMain)
    await flushPromises()

    expect(currencyService.getRateHistory).toHaveBeenCalledWith('VEF', 6, 'USD')
  })

  it('al montar tambien pide, en paralelo, la serie de transferencias (against=USDT)', async () => {
    mount(RatesMain)
    await flushPromises()

    expect(currencyService.getRateHistory).toHaveBeenCalledWith('VEF', 6, 'USDT')
  })

  it('cambiar la moneda en el selector vuelve a pedir el historial de la nueva moneda', async () => {
    const wrapper = mount(RatesMain)
    await flushPromises()
    vi.mocked(currencyService.getRateHistory).mockClear()

    const copButton = wrapper.findAll('.pill').find((button) => button.text() === 'COP')
    await copButton!.trigger('click')
    await flushPromises()

    expect(currencyService.getRateHistory).toHaveBeenCalledWith('COP', 6, 'USD')
  })

  it('cambiar la ventana de meses vuelve a pedir el historial con la nueva ventana', async () => {
    const wrapper = mount(RatesMain)
    await flushPromises()
    vi.mocked(currencyService.getRateHistory).mockClear()

    const twelveMonthsButton = wrapper.findAll('.months-toggle-option').find((button) => button.text() === '12M')
    await twelveMonthsButton!.trigger('click')
    await flushPromises()

    expect(currencyService.getRateHistory).toHaveBeenCalledWith('VEF', 12, 'USD')
  })

  it('muestra la tasa mas reciente y la marca como estimada cuando corresponde', async () => {
    mockDefaultHistory([{ rate: 700 }, { rate: 800, isEstimated: true }])

    const wrapper = mount(RatesMain)
    await flushPromises()

    expect(wrapper.find('.rate-card-value').text()).toContain('800')
    expect(wrapper.find('.rate-card-estimated').exists()).toBe(true)
  })

  it('si el service de la serie oficial falla, muestra un mensaje de error en vez de romper', async () => {
    vi.spyOn(currencyService, 'getRateHistory').mockImplementation(async (_code, _months, against = 'USD') => {
      if (against === 'USDT') return historyResult('VEF', 'USDT', [])
      throw new Error('no se pudo')
    })

    const wrapper = mount(RatesMain)
    await flushPromises()

    expect(wrapper.find('.rate-error').text()).toBe('no se pudo')
  })

  // Comparativa "tus transferencias" (pedido explicito del usuario: "quiero
  // comparativas... de cuanto estaba aprox el usdt ese dia y a esa hora") -----------

  it('sin datos de transferencias, no muestra la pestaña de comparativa', async () => {
    const wrapper = mount(RatesMain)
    await flushPromises()

    expect(wrapper.find('.series-toggle').exists()).toBe(false)
  })

  it('con datos de transferencias, muestra la pestaña y permite alternar entre oficial y transferencias', async () => {
    vi.spyOn(currencyService, 'getRateHistory').mockImplementation(async (code, _months, against = 'USD') => {
      if (against === 'USDT') return historyResult(code, 'USDT', [{ rate: 190 }])
      return historyResult(code, 'USD', [{ rate: 800 }])
    })

    const wrapper = mount(RatesMain)
    await flushPromises()

    expect(wrapper.find('.series-toggle').exists()).toBe(true)
    expect(wrapper.find('.rate-card-value').text()).toContain('800.0000') // arranca en "oficial"

    const transferTab = wrapper.findAll('.series-toggle-option').find((btn) => btn.text() === 'Tus transferencias')
    await transferTab!.trigger('click')

    expect(wrapper.find('.rate-card-value').text()).toContain('190.0000')
    expect(wrapper.find('.rate-card-label').text()).toContain('USDT')
  })

  it('si la moneda no tiene datos de transferencias tras cambiarla, vuelve a la pestaña oficial', async () => {
    vi.spyOn(currencyService, 'getRateHistory').mockImplementation(async (code, _months, against = 'USD') => {
      if (against === 'USDT') return historyResult(code, 'USDT', code === 'VEF' ? [{ rate: 190 }] : [])
      return historyResult(code, 'USD', [{ rate: 800 }])
    })
    const wrapper = mount(RatesMain)
    await flushPromises()
    const transferTab = wrapper.findAll('.series-toggle-option').find((btn) => btn.text() === 'Tus transferencias')
    await transferTab!.trigger('click')
    expect(wrapper.find('.rate-card-label').text()).toContain('USDT')

    const copButton = wrapper.findAll('.pill').find((button) => button.text() === 'COP')
    await copButton!.trigger('click')
    await flushPromises()

    expect(wrapper.find('.series-toggle').exists()).toBe(false)
    expect(wrapper.find('.rate-card-label').text()).toContain('USD')
  })
})
