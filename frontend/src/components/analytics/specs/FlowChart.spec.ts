import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import type { TimelineBucket } from '../../../services/analytics/interfaces/analytics.interface'
import FlowChart from '../FlowChart.vue'

const bucket = (start: string, totalExpense: number, totalIncome = 0): TimelineBucket => ({
  start,
  totalExpense,
  totalIncome,
  net: totalIncome - totalExpense,
  count: 1,
})

// Fechas lejanas: ningun periodo cuenta como "en curso".
const BUCKETS = [bucket('2020-01-01', 100, 400), bucket('2020-02-01', 300, 0), bucket('2020-03-01', 200, 50)]

function mountChart(overrides: Record<string, unknown> = {}) {
  return mount(FlowChart, {
    props: {
      buckets: BUCKETS,
      granularity: 'month',
      currency: 'USD',
      wallets: [],
      walletId: null,
      ready: true,
      refreshing: false,
      ...overrides,
    },
  })
}

describe('FlowChart', () => {
  it('dibuja una columna por periodo y, en vista mensual, tambien las barras de ingreso', () => {
    const wrapper = mountChart()

    expect(wrapper.findAll('.flow-column')).toHaveLength(3)
    expect(wrapper.findAll('.flow-bar.income')).toHaveLength(3)
  })

  it('en vistas por dia o semana solo dibuja gasto', () => {
    const wrapper = mountChart({ granularity: 'day' })

    expect(wrapper.findAll('.flow-bar.expense')).toHaveLength(3)
    expect(wrapper.findAll('.flow-bar.income')).toHaveLength(0)
  })

  it('sin cursor la lectura muestra el ultimo periodo completo', () => {
    const wrapper = mountChart()

    expect(wrapper.find('.flow-readout').text()).toContain('$200.00')
  })

  it('al pasar el cursor por una barra, la lectura cambia a ese periodo y al salir vuelve', async () => {
    const wrapper = mountChart()

    await wrapper.findAll('.flow-column')[1].trigger('mouseenter')
    expect(wrapper.find('.flow-readout').text()).toContain('$300.00')

    await wrapper.find('.flow-plot').trigger('mouseleave')
    expect(wrapper.find('.flow-readout').text()).toContain('$200.00')
  })

  it('cada barra es un boton con su descripcion para lectores de pantalla', () => {
    const wrapper = mountChart()

    const first = wrapper.findAll('button.flow-column')[0]
    expect(first.attributes('aria-label')).toContain('gastos $100.00')
  })

  it('al elegir una billetera avisa con su id, y "todas" avisa con null', async () => {
    const wrapper = mountChart({
      wallets: [{ id: 'w1', name: 'Efectivo', currency: 'USD', balance: 0, createdAt: '' }],
    })
    const select = wrapper.find('select')

    await select.setValue('w1')
    await select.setValue('')

    expect(wrapper.emitted('update:walletId')).toEqual([['w1'], [null]])
  })

  it('mientras no hay datos no pinta barras (queda el placeholder)', () => {
    const wrapper = mountChart({ ready: false, buckets: [] })

    expect(wrapper.find('.flow-column').exists()).toBe(false)
  })
})
