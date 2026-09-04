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

  // Idea de la sesion de brainstorm de UI: antes Tipo/Periodo/Categoria solo
  // se aplicaban al tocar "Filtrar" (ya no existe ese boton), mientras el
  // buscador de texto de Movimientos ya filtraba en vivo - una
  // inconsistencia real. Ahora cada tap aplica de inmediato, igual que el
  // buscador, y no cierra el sheet (el cierre queda a cargo del propio
  // BottomSheet, no de filtrar).
  it('emite "apply" de inmediato al elegir tipo y categoria, sin cerrar', async () => {
    const wrapper = mount(TransactionsFilterSheet, {
      props: { modelValue: DEFAULT_TRANSACTIONS_FILTER, categories: CATEGORIES },
    })

    await wrapper.findAll('.pill').find((btn) => btn.text() === 'Gastos')!.trigger('click')
    expect(wrapper.emitted('apply')![0]).toEqual([{ type: 'expense', period: 'month', category: null }])

    await wrapper.findAll('.category-chip').find((chip) => chip.text() === 'comida')!.trigger('click')
    expect(wrapper.emitted('apply')![1]).toEqual([{ type: 'expense', period: 'month', category: 'comida' }])

    expect(wrapper.emitted('close')).toBeFalsy()
  })

  it('ofrece "Transferencias" como tipo y lo emite en vivo al elegirlo', async () => {
    const wrapper = mount(TransactionsFilterSheet, {
      props: { modelValue: DEFAULT_TRANSACTIONS_FILTER, categories: CATEGORIES },
    })

    await wrapper.findAll('.pill').find((btn) => btn.text() === 'Transferencias')!.trigger('click')

    expect(wrapper.emitted('apply')![0]).toEqual([{ type: 'transfer', period: 'month', category: null }])
  })

  it('"Limpiar" aplica el filtro por defecto sin cerrar el sheet', async () => {
    const wrapper = mount(TransactionsFilterSheet, {
      props: { modelValue: { type: 'expense', period: '30', category: 'comida' }, categories: CATEGORIES },
    })

    await wrapper.findAll('button').find((btn) => btn.text() === 'Limpiar')!.trigger('click')

    expect(wrapper.emitted('apply')![0]).toEqual([DEFAULT_TRANSACTIONS_FILTER])
    expect(wrapper.emitted('close')).toBeFalsy()
  })

  it('ya no ofrece un boton "Filtrar" separado', () => {
    const wrapper = mount(TransactionsFilterSheet, {
      props: { modelValue: DEFAULT_TRANSACTIONS_FILTER, categories: CATEGORIES },
    })

    expect(wrapper.findAll('button').some((btn) => btn.text() === 'Filtrar')).toBe(false)
  })
})
