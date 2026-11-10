import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import type { Insight } from '../../../services/analytics/interfaces/analytics.interface'
import InsightsList from '../InsightsList.vue'

const INSIGHTS: Insight[] = [
  { code: 'projected_overspend', level: 'alert', category: null, amount: 1777, referenceAmount: 1502, percent: 18.3, weekday: null },
  { code: 'category_drop', level: 'info', category: 'Transporte', amount: 64, referenceAmount: 70, percent: -9, weekday: null },
]

describe('InsightsList', () => {
  it('mientras carga reserva 4 tarjetas de placeholder y no muestra texto', () => {
    const wrapper = mount(InsightsList, { props: { insights: [], currency: 'USD', ready: false } })

    expect(wrapper.findAll('.insight-placeholder')).toHaveLength(4)
    expect(wrapper.find('.insight').exists()).toBe(false)
  })

  it('con datos muestra una tarjeta por recomendacion con su etiqueta y texto', () => {
    const wrapper = mount(InsightsList, { props: { insights: INSIGHTS, currency: 'USD', ready: true } })

    const cards = wrapper.findAll('.insight')
    expect(cards).toHaveLength(2)
    expect(cards[0].classes()).toContain('alert')
    expect(cards[0].text()).toContain('Alerta')
    expect(cards[0].text()).toContain('Vas camino a cerrar sobre tu promedio')
    expect(cards[1].text()).toContain('Buen dato')
    expect(cards[1].text()).toContain('Transporte bajó 9%')
  })
})
