import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import MonthSummaryCards from '../MonthSummaryCards.vue'

describe('MonthSummaryCards', () => {
  it('muestra las etiquetas de Ingresos y Gastos', () => {
    const wrapper = mount(MonthSummaryCards, { props: { income: 100, expenses: 40, currency: 'USD' } })

    expect(wrapper.text()).toContain('Ingresos')
    expect(wrapper.text()).toContain('Gastos')
  })
})
