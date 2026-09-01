import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import type { MonthlyComparison } from '../../../services/analytics/interfaces/analytics.interface'
import MonthlyComparisonTable from '../MonthlyComparisonTable.vue'

function month(month: string, totalIncome: number, totalExpense: number): MonthlyComparison {
  return { month, totalIncome, totalExpense, net: totalIncome - totalExpense }
}

describe('MonthlyComparisonTable', () => {
  it('sin meses muestra el estado vacío', () => {
    const wrapper = mount(MonthlyComparisonTable, { props: { months: [] } })

    expect(wrapper.text()).toContain('No hay datos para mostrar todavía.')
    expect(wrapper.findAll('.monthly-bar-column')).toHaveLength(0)
  })

  it('dibuja una columna por mes, con 2 barras (ingreso/gasto) cada una', () => {
    const months = [month('2026-07', 1000, 700), month('2026-08', 900, 800), month('2026-09', 1500, 935)]

    const wrapper = mount(MonthlyComparisonTable, { props: { months, currency: 'USD' } })

    expect(wrapper.findAll('.monthly-bar-column')).toHaveLength(3)
    expect(wrapper.findAll('.monthly-bar.income')).toHaveLength(3)
    expect(wrapper.findAll('.monthly-bar.expense')).toHaveLength(3)
  })

  it('la escala es compartida entre todos los meses - la barra mas alta llega a 100%', () => {
    const months = [month('2026-08', 500, 200), month('2026-09', 1500, 935)]
    // maximo global: 1500 (ingreso de septiembre)

    const wrapper = mount(MonthlyComparisonTable, { props: { months, currency: 'USD' } })

    const incomeBars = wrapper.findAll('.monthly-bar.income')
    expect((incomeBars[0].element as HTMLElement).style.height).toBe('33.33333333333333%') // 500/1500
    expect((incomeBars[1].element as HTMLElement).style.height).toBe('100%') // 1500/1500
  })

  it('solo la columna del mes actual (la ultima) muestra el monto neto en numero', () => {
    const months = [month('2026-07', 1000, 700), month('2026-08', 1500, 935)]

    const wrapper = mount(MonthlyComparisonTable, { props: { months, currency: 'USD' } })

    expect(wrapper.findAll('.monthly-bar-net')).toHaveLength(1)
    expect(wrapper.find('.monthly-bar-net').text()).toContain('$565.00')
  })

  it('el neto negativo del mes actual queda marcado (accent)', () => {
    const months = [month('2026-08', 100, 900)]

    const wrapper = mount(MonthlyComparisonTable, { props: { months, currency: 'USD' } })

    expect(wrapper.find('.monthly-bar-net.negative').exists()).toBe(true)
  })

  it('un mes en cero no queda con una barra invisible - hay un piso minimo de alto', () => {
    const months = [month('2026-08', 0, 0), month('2026-09', 1000, 500)]

    const wrapper = mount(MonthlyComparisonTable, { props: { months, currency: 'USD' } })

    const incomeBars = wrapper.findAll('.monthly-bar.income')
    expect((incomeBars[0].element as HTMLElement).style.height).not.toBe('0%')
  })
})
