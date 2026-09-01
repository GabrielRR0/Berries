import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import type { CategoryMonthlyTrend } from '../../../services/analytics/interfaces/analytics.interface'
import CategoryMonthlyTrendChart from '../CategoryMonthlyTrendChart.vue'

describe('CategoryMonthlyTrendChart', () => {
  it('muestra el nombre de la categoría y el monto del mes mas reciente', () => {
    const trend: CategoryMonthlyTrend = {
      months: ['2026-07', '2026-08'],
      categories: [{ category: 'Mercado', monthlyTotals: [80, 120] }],
    }

    const wrapper = mount(CategoryMonthlyTrendChart, { props: { trend, type: 'expense', currency: 'USD' } })

    expect(wrapper.text()).toContain('Mercado')
    expect(wrapper.text()).toContain('$120.00')
  })

  it('con un solo mes de historial no muestra comparación contra el mes anterior', () => {
    const trend: CategoryMonthlyTrend = {
      months: ['2026-08'],
      categories: [{ category: 'Mercado', monthlyTotals: [80] }],
    }

    const wrapper = mount(CategoryMonthlyTrendChart, { props: { trend, type: 'expense', currency: 'USD' } })

    expect(wrapper.text()).not.toContain('vs mes anterior')
  })

  it('un gasto que SUBE respecto al mes anterior queda marcado (acento)', () => {
    const trend: CategoryMonthlyTrend = {
      months: ['2026-07', '2026-08'],
      categories: [{ category: 'Mercado', monthlyTotals: [80, 120] }],
    }

    const wrapper = mount(CategoryMonthlyTrendChart, { props: { trend, type: 'expense', currency: 'USD' } })

    expect(wrapper.text()).toContain('+$40.00 vs mes anterior')
    expect(wrapper.find('.category-trend-delta.flagged').exists()).toBe(true)
  })

  it('un gasto que BAJA respecto al mes anterior no queda marcado', () => {
    const trend: CategoryMonthlyTrend = {
      months: ['2026-07', '2026-08'],
      categories: [{ category: 'Mercado', monthlyTotals: [120, 80] }],
    }

    const wrapper = mount(CategoryMonthlyTrendChart, { props: { trend, type: 'expense', currency: 'USD' } })

    expect(wrapper.text()).toContain('-$40.00 vs mes anterior')
    expect(wrapper.find('.category-trend-delta.flagged').exists()).toBe(false)
  })

  it('un ingreso que sube NUNCA queda marcado con el acento (reservado para gastos que suben)', () => {
    const trend: CategoryMonthlyTrend = {
      months: ['2026-07', '2026-08'],
      categories: [{ category: 'Salario', monthlyTotals: [1000, 1500] }],
    }

    const wrapper = mount(CategoryMonthlyTrendChart, { props: { trend, type: 'income', currency: 'USD' } })

    expect(wrapper.text()).toContain('+$500.00 vs mes anterior')
    expect(wrapper.find('.category-trend-delta.flagged').exists()).toBe(false)
  })

  it('dibuja una barra de sparkline por cada mes de la categoría', () => {
    const trend: CategoryMonthlyTrend = {
      months: ['2026-06', '2026-07', '2026-08'],
      categories: [{ category: 'Mercado', monthlyTotals: [50, 80, 120] }],
    }

    const wrapper = mount(CategoryMonthlyTrendChart, { props: { trend, type: 'expense', currency: 'USD' } })

    expect(wrapper.findAll('.category-trend-bar')).toHaveLength(3)
  })

  it('sin datos (trend null) muestra el estado vacío en vez de romper', () => {
    const wrapper = mount(CategoryMonthlyTrendChart, { props: { trend: null, type: 'expense', currency: 'USD' } })

    expect(wrapper.text()).toContain('Sin datos para este período.')
  })

  it('con categorías vacías tambien muestra el estado vacío', () => {
    const trend: CategoryMonthlyTrend = { months: ['2026-08'], categories: [] }

    const wrapper = mount(CategoryMonthlyTrendChart, { props: { trend, type: 'expense', currency: 'USD' } })

    expect(wrapper.text()).toContain('Sin datos para este período.')
  })
})
