import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import SectionHeader from '../SectionHeader.vue'

describe('SectionHeader', () => {
  it('muestra el titulo recibido por props', () => {
    const wrapper = mount(SectionHeader, { props: { title: 'Cuentas' } })

    expect(wrapper.text()).toContain('Cuentas')
  })

  it('emite "back" al hacer click en el boton de volver', async () => {
    const wrapper = mount(SectionHeader, { props: { title: 'Cuentas' } })

    await wrapper.find('[aria-label="Volver"]').trigger('click')

    expect(wrapper.emitted('back')).toBeTruthy()
  })

  it('emite "help" al hacer click en el boton de interrogacion', async () => {
    const wrapper = mount(SectionHeader, { props: { title: 'Cuentas' } })

    await wrapper.find('[aria-label="¿Qué es esta sección?"]').trigger('click')

    expect(wrapper.emitted('help')).toBeTruthy()
  })
})
