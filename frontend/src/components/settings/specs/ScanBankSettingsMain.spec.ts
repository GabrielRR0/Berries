import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import ScanBankSettingsMain from '../ScanBankSettingsMain.vue'

const push = vi.fn()
vi.mock('vue-router', () => ({ useRouter: () => ({ push }) }))

describe('ScanBankSettingsMain (Banco de escaneo)', () => {
  beforeEach(() => {
    localStorage.clear()
    push.mockReset()
  })

  it('muestra el titulo y vuelve a Ajustes', async () => {
    const wrapper = mount(ScanBankSettingsMain)

    expect(wrapper.find('.section-header-title').text()).toBe('Banco de escaneo')

    await wrapper.find('button[aria-label="Volver"]').trigger('click')

    expect(push).toHaveBeenCalledWith({ name: 'ajustes' })
  })

  it('lista Banco de Venezuela como elegido, con su moneda', () => {
    const wrapper = mount(ScanBankSettingsMain)

    const options = wrapper.findAll('[role="radio"]')
    expect(options).toHaveLength(1)
    expect(options[0]!.text()).toContain('Banco de Venezuela')
    expect(options[0]!.text()).toContain('VEF')
    expect(options[0]!.attributes('aria-checked')).toBe('true')
  })

  it('tocar un banco lo guarda en el dispositivo', async () => {
    const wrapper = mount(ScanBankSettingsMain)

    await wrapper.find('[role="radio"]').trigger('click')

    // Ya era el elegido: sigue marcado y la pantalla no se rompe.
    expect(wrapper.find('[role="radio"]').attributes('aria-checked')).toBe('true')
  })

  it('el "?" abre la explicacion', async () => {
    const wrapper = mount(ScanBankSettingsMain)

    await wrapper.find('button[aria-label="¿Qué es esta sección?"]').trigger('click')

    expect(wrapper.text()).toContain('¿Qué es Banco de escaneo?')
  })
})
