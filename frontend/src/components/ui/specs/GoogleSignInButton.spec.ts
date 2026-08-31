import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import GoogleSignInButton from '../GoogleSignInButton.vue'

describe('GoogleSignInButton', () => {
  afterEach(() => {
    document.querySelectorAll('script[src*="accounts.google.com"]').forEach((el) => el.remove())
    delete window.google
  })

  it('no renderiza nada sin VITE_GOOGLE_CLIENT_ID configurada (comportamiento por defecto de este proyecto)', () => {
    const wrapper = mount(GoogleSignInButton)

    expect(wrapper.find('.google-signin-button').exists()).toBe(false)
  })

  it('no intenta cargar el script de Google sin client id configurada', () => {
    mount(GoogleSignInButton)

    expect(document.querySelector('script[src*="accounts.google.com"]')).toBeNull()
  })
})
