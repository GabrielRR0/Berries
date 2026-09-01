import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import type { MonthlyComparison } from '../../../services/analytics/interfaces/analytics.interface'
import CumulativeSavingsChart from '../CumulativeSavingsChart.vue'

function month(month: string, totalIncome: number, totalExpense: number): MonthlyComparison {
  return { month, totalIncome, totalExpense, net: totalIncome - totalExpense }
}

describe('CumulativeSavingsChart', () => {
  it('suma el ahorro (ingreso - gasto) mes a mes, no solo el neto de un mes suelto', () => {
    const months = [month('2026-06', 1000, 700), month('2026-07', 900, 800), month('2026-08', 1200, 600)]
    // net: 300 + 100 + 600 = 1000 acumulado

    const wrapper = mount(CumulativeSavingsChart, { props: { months, currency: 'USD' } })

    expect(wrapper.text()).toContain('$1,000.00')
  })

  it('muestra el aporte del mes mas reciente con signo, no el acumulado', () => {
    const months = [month('2026-07', 900, 800), month('2026-08', 1200, 600)]
    // net del mes mas reciente: 600

    const wrapper = mount(CumulativeSavingsChart, { props: { months, currency: 'USD' } })

    expect(wrapper.text()).toContain('+$600.00 este mes')
  })

  it('el aporte negativo del mes mas reciente no lleva signo + de mas', () => {
    const months = [month('2026-07', 900, 800), month('2026-08', 400, 900)]
    // net del mes mas reciente: -500

    const wrapper = mount(CumulativeSavingsChart, { props: { months, currency: 'USD' } })

    expect(wrapper.text()).toContain('-$500.00 este mes')
    expect(wrapper.text()).not.toContain('+-$500.00')
  })

  it('marca el total como negativo (accent) cuando el acumulado de la ventana es negativo', () => {
    const months = [month('2026-07', 200, 900), month('2026-08', 100, 300)]
    // net: -700 + -200 = -900 acumulado

    const wrapper = mount(CumulativeSavingsChart, { props: { months, currency: 'USD' } })

    expect(wrapper.find('.cumulative-value.negative').exists()).toBe(true)
  })

  it('con menos de 2 meses no dibuja la linea - muestra el mensaje de historial insuficiente', () => {
    const wrapper = mount(CumulativeSavingsChart, { props: { months: [month('2026-08', 500, 200)], currency: 'USD' } })

    expect(wrapper.find('.cumulative-chart').exists()).toBe(false)
    expect(wrapper.text()).toContain('Necesitamos al menos 2 meses de historial')
  })

  it('con 0 meses tampoco rompe - el acumulado queda en 0', () => {
    const wrapper = mount(CumulativeSavingsChart, { props: { months: [], currency: 'USD' } })

    expect(wrapper.text()).toContain('$0.00')
    expect(wrapper.find('.cumulative-chart').exists()).toBe(false)
  })

  it('con 2+ meses dibuja un punto por cada mes anterior, mas el punto brillante del mes actual', () => {
    const months = [month('2026-06', 1000, 700), month('2026-07', 900, 800), month('2026-08', 1200, 600)]

    const wrapper = mount(CumulativeSavingsChart, { props: { months, currency: 'USD' } })

    // 3 meses: 2 puntos "huecos" (todos menos el ultimo) + el punto
    // brillante del mes actual (glow + nucleo, ver CumulativeSavingsChart.vue).
    expect(wrapper.findAll('.cumulative-dot')).toHaveLength(2)
    expect(wrapper.find('.cumulative-dot-glow').exists()).toBe(true)
    expect(wrapper.find('.cumulative-dot-core').exists()).toBe(true)
  })

  it('el punto brillante del mes actual queda en rojo cuando el acumulado es negativo', () => {
    const months = [month('2026-07', 200, 900), month('2026-08', 100, 300)]
    // acumulado: -700 + -200 = -900

    const wrapper = mount(CumulativeSavingsChart, { props: { months, currency: 'USD' } })

    expect(wrapper.find('.cumulative-dot-glow.negative').exists()).toBe(true)
    expect(wrapper.find('.cumulative-dot-core.negative').exists()).toBe(true)
  })
})
