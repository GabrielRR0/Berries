import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ToggleSwitch from '../ToggleSwitch.vue'

describe('ToggleSwitch', () => {
  it('muestra el label recibido', () => {
    const wrapper = mount(ToggleSwitch, { props: { modelValue: false, label: 'Balances y billeteras' } })

    expect(wrapper.text()).toContain('Balances y billeteras')
  })

  it('refleja modelValue=false como apagado (aria-checked=false, sin la clase active)', () => {
    const wrapper = mount(ToggleSwitch, { props: { modelValue: false, label: 'Historial' } })

    const button = wrapper.find('button')
    expect(button.attributes('aria-checked')).toBe('false')
    expect(button.classes()).not.toContain('active')
  })

  it('refleja modelValue=true como encendido (aria-checked=true, con la clase active)', () => {
    const wrapper = mount(ToggleSwitch, { props: { modelValue: true, label: 'Historial' } })

    const button = wrapper.find('button')
    expect(button.attributes('aria-checked')).toBe('true')
    expect(button.classes()).toContain('active')
  })

  it('clickear emite update:modelValue invertido', async () => {
    const wrapper = mount(ToggleSwitch, { props: { modelValue: false, label: 'Categorías' } })

    await wrapper.find('button').trigger('click')

    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([true])
  })
})
