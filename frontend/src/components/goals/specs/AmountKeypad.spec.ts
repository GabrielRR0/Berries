import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import AmountKeypad from '../AmountKeypad.vue'

function pressLabel(wrapper: ReturnType<typeof mount>, label: string) {
  return wrapper.findAll('.key').find((key) => key.text() === label)!.trigger('click')
}

describe('AmountKeypad', () => {
  it('agrega digitos al valor', async () => {
    const wrapper = mount(AmountKeypad, { props: { modelValue: '' } })

    await pressLabel(wrapper, '1')

    expect(wrapper.emitted('update:modelValue')).toEqual([['1']])
  })

  it('reemplaza un "0" inicial en vez de concatenar (evita "01")', async () => {
    const wrapper = mount(AmountKeypad, { props: { modelValue: '0' } })

    await pressLabel(wrapper, '5')

    expect(wrapper.emitted('update:modelValue')).toEqual([['5']])
  })

  it('agrega un punto decimal una sola vez', async () => {
    const wrapper = mount(AmountKeypad, { props: { modelValue: '12' } })

    await pressLabel(wrapper, '.')

    expect(wrapper.emitted('update:modelValue')).toEqual([['12.']])
  })

  it('no agrega un segundo punto decimal', async () => {
    const wrapper = mount(AmountKeypad, { props: { modelValue: '12.5' } })

    await pressLabel(wrapper, '.')

    expect(wrapper.emitted('update:modelValue')).toBeFalsy()
  })

  it('el punto decimal sobre un valor vacio arranca en "0."', async () => {
    const wrapper = mount(AmountKeypad, { props: { modelValue: '' } })

    await pressLabel(wrapper, '.')

    expect(wrapper.emitted('update:modelValue')).toEqual([['0.']])
  })

  it('borrar quita el ultimo caracter', async () => {
    const wrapper = mount(AmountKeypad, { props: { modelValue: '123' } })

    await pressLabel(wrapper, '⌫')

    expect(wrapper.emitted('update:modelValue')).toEqual([['12']])
  })
})
