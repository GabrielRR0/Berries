import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import TransactionsFilterSheet, { DEFAULT_TRANSACTIONS_FILTER } from '../TransactionsFilterSheet.vue'

const CATEGORIES = ['comida', 'transporte', 'salario']

describe('TransactionsFilterSheet', () => {
  it('arranca con el tipo/periodo/categoria del filtro activo', () => {
    const wrapper = mount(TransactionsFilterSheet, {
      props: { modelValue: { type: 'income', period: '7', category: 'salario' }, categories: CATEGORIES },
    })

    const activeTypePill = wrapper.findAll('.pill').find((btn) => btn.classes('active'))
    expect(activeTypePill?.text()).toBe('Ingresos')
    expect(wrapper.find('.category-chip.active').text()).toBe('salario')
  })

  it('filtra los chips de categoria por la busqueda', async () => {
    const wrapper = mount(TransactionsFilterSheet, {
      props: { modelValue: DEFAULT_TRANSACTIONS_FILTER, categories: CATEGORIES },
    })

    await wrapper.find('.category-search').setValue('trans')

    const chipLabels = wrapper.findAll('.category-chip').map((chip) => chip.text())
    expect(chipLabels).toEqual(['Todas', 'transporte'])
  })

  it('emite "apply" con la seleccion y cierra al tocar "Filtrar"', async () => {
    const wrapper = mount(TransactionsFilterSheet, {
      props: { modelValue: DEFAULT_TRANSACTIONS_FILTER, categories: CATEGORIES },
    })

    await wrapper.findAll('.pill').find((btn) => btn.text() === 'Gastos')!.trigger('click')
    await wrapper.findAll('.category-chip').find((chip) => chip.text() === 'comida')!.trigger('click')
    await wrapper.findAll('button').find((btn) => btn.text() === 'Filtrar')!.trigger('click')

    expect(wrapper.emitted('apply')![0]).toEqual([{ type: 'expense', period: 'month', category: 'comida' }])
    expect(wrapper.emitted('close')).toBeTruthy()
  })

  it('ofrece "Transferencias" como tipo y lo emite al elegirlo', async () => {
    const wrapper = mount(TransactionsFilterSheet, {
      props: { modelValue: DEFAULT_TRANSACTIONS_FILTER, categories: CATEGORIES },
    })

    await wrapper.findAll('.pill').find((btn) => btn.text() === 'Transferencias')!.trigger('click')
    await wrapper.findAll('button').find((btn) => btn.text() === 'Filtrar')!.trigger('click')

    expect(wrapper.emitted('apply')![0]).toEqual([{ type: 'transfer', period: 'month', category: null }])
  })

  it('emite "apply" con el filtro por defecto y cierra al tocar "Limpiar"', async () => {
    const wrapper = mount(TransactionsFilterSheet, {
      props: { modelValue: { type: 'expense', period: '30', category: 'comida' }, categories: CATEGORIES },
    })

    await wrapper.findAll('button').find((btn) => btn.text() === 'Limpiar')!.trigger('click')

    expect(wrapper.emitted('apply')![0]).toEqual([DEFAULT_TRANSACTIONS_FILTER])
    expect(wrapper.emitted('close')).toBeTruthy()
  })
})
