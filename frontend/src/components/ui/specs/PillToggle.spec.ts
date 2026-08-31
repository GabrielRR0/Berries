import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import PillToggle from '../PillToggle.vue'

const OPTIONS = [
  { value: 'all', label: 'Todos' },
  { value: 'income', label: 'Ingresos' },
  { value: 'expense', label: 'Gastos' },
]

describe('PillToggle', () => {
  it('muestra las etiquetas, no los valores', () => {
    const wrapper = mount(PillToggle, { props: { options: OPTIONS, modelValue: 'all' } })

    expect(wrapper.text()).toContain('Ingresos')
    expect(wrapper.text()).not.toContain('income')
  })

  it('marca como activa la opcion que coincide con modelValue', () => {
    const wrapper = mount(PillToggle, { props: { options: OPTIONS, modelValue: 'income' } })

    const activeButton = wrapper.findAll('button').find((btn) => btn.classes('active'))
    expect(activeButton?.text()).toBe('Ingresos')
  })

  it('emite "update:modelValue" con el value de la opcion clickeada', async () => {
    const wrapper = mount(PillToggle, { props: { options: OPTIONS, modelValue: 'all' } })

    const expenseButton = wrapper.findAll('button').find((btn) => btn.text() === 'Gastos')
    await expenseButton!.trigger('click')

    expect(wrapper.emitted('update:modelValue')![0]).toEqual(['expense'])
  })
})
