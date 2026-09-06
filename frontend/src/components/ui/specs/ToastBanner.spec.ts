import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useToast } from '../../../composables/toast/useToast'
import ToastBanner from '../ToastBanner.vue'

describe('ToastBanner', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    // useToast es un singleton de modulo (mismo criterio que useOnlineStatus) -
    // sin este flush, un toast que quedo activo en un test se filtraria al
    // siguiente (no hay reset entre tests, a diferencia de vi.resetModules()).
    vi.advanceTimersByTime(10000)
    vi.useRealTimers()
  })

  it('no muestra nada si no hay ningun toast activo', () => {
    const wrapper = mount(ToastBanner)

    expect(wrapper.find('.toast-banner').exists()).toBe(false)
  })

  it('muestra el texto del toast activo cuando se dispara uno', async () => {
    const wrapper = mount(ToastBanner)
    const { showToast } = useToast()

    showToast('Guardado sin conexión')
    await wrapper.vm.$nextTick()

    expect(wrapper.find('.toast-banner').text()).toBe('Guardado sin conexión')
  })

  it('aplica la clase de tono correspondiente', async () => {
    const wrapper = mount(ToastBanner)
    const { showToast } = useToast()

    showToast('Algo falló', 'error')
    await wrapper.vm.$nextTick()

    expect(wrapper.find('.toast-banner').classes()).toContain('toast-banner--error')
  })

  it('el toast desaparece solo despues de un rato', async () => {
    const wrapper = mount(ToastBanner)
    const { showToast } = useToast()

    showToast('Se sincronizó')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.toast-banner').exists()).toBe(true)

    vi.advanceTimersByTime(5000)
    await wrapper.vm.$nextTick()

    expect(wrapper.find('.toast-banner').exists()).toBe(false)
  })
})
