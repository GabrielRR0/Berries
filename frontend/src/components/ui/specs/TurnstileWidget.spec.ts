import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import TurnstileWidget from '../TurnstileWidget.vue'

describe('TurnstileWidget', () => {
  afterEach(() => {
    // El componente agrega un <script> real al <head> cuando hay site key -
    // limpiar entre tests para no acumular scripts de una prueba a otra.
    document.querySelectorAll('script[src*="turnstile"]').forEach((el) => el.remove())
    delete window.turnstile
    delete window.__berryTurnstileLoad
  })

  it('no renderiza nada sin VITE_TURNSTILE_SITE_KEY configurada (comportamiento por defecto de este proyecto)', () => {
    const wrapper = mount(TurnstileWidget)

    expect(wrapper.find('.turnstile-widget').exists()).toBe(false)
  })

  it('no intenta cargar el script de Cloudflare sin site key configurada', () => {
    mount(TurnstileWidget)

    expect(document.querySelector('script[src*="turnstile"]')).toBeNull()
  })
})
