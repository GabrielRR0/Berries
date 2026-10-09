import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import type { RateHistoryPoint } from '../../../services/currency/interfaces/currency.interface'
import RateHistoryChart from '../RateHistoryChart.vue'

function point(fetchedAt: string, rate: number, isEstimated = false): RateHistoryPoint {
  return { fetchedAt, rate, source: isEstimated ? 'fallback-stale' : 'dolarapi-oficial', isEstimated }
}

describe('RateHistoryChart', () => {
  it('muestra un mensaje cuando no hay suficiente historial para graficar', () => {
    const wrapper = mount(RateHistoryChart, { props: { points: [point('2026-09-01', 800)], currencyCode: 'VEF' } })

    expect(wrapper.find('.rate-history-empty').exists()).toBe(true)
    expect(wrapper.find('.chart-svg').exists()).toBe(false)
  })

  it('dibuja la linea y los ejes cuando hay suficientes puntos', () => {
    const points = [point('2026-06-01', 700), point('2026-07-01', 750), point('2026-08-01', 800), point('2026-09-01', 850)]
    const wrapper = mount(RateHistoryChart, { props: { points, currencyCode: 'VEF' } })

    expect(wrapper.find('.chart-line').exists()).toBe(true)
    // formatCurrency(VEF) usa locale es-VE ("Bs. 850,00", coma decimal).
    expect(wrapper.find('.chart-y-axis').text()).toContain('850') // max
    expect(wrapper.find('.chart-y-axis').text()).toContain('700') // min
  })

  it('marca los puntos estimados con un anillo y muestra la leyenda solo si existen', () => {
    const points = [point('2026-06-01', 700), point('2026-07-01', 750, true), point('2026-08-01', 800)]
    const wrapper = mount(RateHistoryChart, { props: { points, currencyCode: 'VEF' } })

    expect(wrapper.findAll('.chart-estimated-dot')).toHaveLength(1)
    expect(wrapper.find('.chart-legend').exists()).toBe(true)
  })

  it('no muestra la leyenda de estimadas si ningun punto lo es', () => {
    const points = [point('2026-06-01', 700), point('2026-07-01', 750), point('2026-08-01', 800)]
    const wrapper = mount(RateHistoryChart, { props: { points, currencyCode: 'VEF' } })

    expect(wrapper.find('.chart-legend').exists()).toBe(false)
  })

  it('limita las etiquetas del eje X a un maximo de 4 aunque haya muchos puntos', () => {
    const points = Array.from({ length: 12 }, (_, i) => point(`2026-${String(i + 1).padStart(2, '0')}-01`, 700 + i * 5))
    const wrapper = mount(RateHistoryChart, { props: { points, currencyCode: 'VEF' } })

    expect(wrapper.findAll('.chart-x-label').length).toBeLessThanOrEqual(4)
  })

  it('quoteCode por default es USD, pero puede mostrarse contra otra moneda (ej. USDT)', () => {
    const points = [point('2026-06-01', 190), point('2026-07-01', 195), point('2026-08-01', 200)]
    const wrapper = mount(RateHistoryChart, { props: { points, currencyCode: 'VEF', quoteCode: 'USDT' } })

    expect(wrapper.attributes('aria-label') ?? wrapper.find('.chart-canvas').attributes('aria-label')).toContain('USDT')
  })
})
