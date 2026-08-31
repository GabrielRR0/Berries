import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { checkGoogleAccountExists, googleLogin, loginUser } from '../../../services/auth/auth.service'
import { useAuthStore } from '../../../stores/auth.store'
import LoginForm from '../LoginForm.vue'

vi.mock('../../../services/auth/auth.service', async () => {
  const actual = await vi.importActual<typeof import('../../../services/auth/auth.service')>(
    '../../../services/auth/auth.service',
  )
  return { ...actual, loginUser: vi.fn(), googleLogin: vi.fn(), checkGoogleAccountExists: vi.fn() }
})

// Fuerza el boton de Google visible (por default queda apagado sin
// VITE_GOOGLE_CLIENT_ID, ver googleAuthConfig.ts).
vi.mock('../../../utils/google/googleAuthConfig', () => ({ isGoogleSignInEnabled: true }))

const push = vi.fn()
vi.mock('vue-router', () => ({ useRouter: () => ({ push }) }))

function makeFakeIdToken(claims: { email?: string; name?: string }): string {
  const header = btoa(JSON.stringify({ alg: 'none' }))
  const payload = btoa(JSON.stringify(claims))
  return `${header}.${payload}.signature`
}

const FAKE_ID_TOKEN = makeFakeIdToken({ email: 'ash@gmail.com', name: 'Ash' })

function mountLoginForm() {
  return mount(LoginForm, {
    global: {
      stubs: {
        RouterLink: true,
        GoogleSignInButton: {
          template: '<button class="google-stub" type="button" @click="$emit(\'credential\', fakeToken)"></button>',
          data: () => ({ fakeToken: FAKE_ID_TOKEN }),
        },
      },
    },
  })
}

describe('LoginForm - Continuar con Google', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    push.mockReset()
    vi.mocked(loginUser).mockReset()
    vi.mocked(googleLogin).mockReset()
    vi.mocked(checkGoogleAccountExists).mockReset()
  })

  it('si la cuenta de Google ya existe, loguea directo y va al dashboard', async () => {
    vi.mocked(checkGoogleAccountExists).mockResolvedValue(true)
    vi.mocked(googleLogin).mockResolvedValue({
      accessToken: 'jwt-token',
      tokenType: 'bearer',
      user: { id: 'user-1', email: 'ash@gmail.com', displayName: 'Ash', defaultCurrency: 'USD', createdAt: '2026-01-01T00:00:00Z' },
    })
    const wrapper = mountLoginForm()

    await wrapper.find('.google-stub').trigger('click')
    await wrapper.vm.$nextTick()
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(googleLogin).toHaveBeenCalledWith(FAKE_ID_TOKEN, undefined, undefined)
    expect(push).toHaveBeenCalledWith({ name: 'dashboard' })
  })

  it('si la cuenta de Google no existe todavia, NO crea nada y manda al wizard de registro', async () => {
    vi.mocked(checkGoogleAccountExists).mockResolvedValue(false)
    const store = useAuthStore()
    const wrapper = mountLoginForm()

    await wrapper.find('.google-stub').trigger('click')
    await wrapper.vm.$nextTick()
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(googleLogin).not.toHaveBeenCalled()
    expect(push).toHaveBeenCalledWith({ name: 'register' })
    // El credential queda "en mano" para que RegisterWizard.vue lo recoja.
    expect(store.consumePendingGoogleIdToken()).toBe(FAKE_ID_TOKEN)
  })

  it('un error al verificar la cuenta de Google se muestra sin redirigir', async () => {
    vi.mocked(checkGoogleAccountExists).mockRejectedValue(new Error('No se pudo verificar la cuenta de Google.'))
    const wrapper = mountLoginForm()

    await wrapper.find('.google-stub').trigger('click')
    await wrapper.vm.$nextTick()
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(wrapper.text()).toContain('No se pudo verificar la cuenta de Google.')
    expect(push).not.toHaveBeenCalled()
  })
})
