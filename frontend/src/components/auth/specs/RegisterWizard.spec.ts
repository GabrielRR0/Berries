import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { googleLogin, registerUser } from '../../../services/auth/auth.service'
import { useAuthStore } from '../../../stores/auth.store'
import RegisterWizard from '../RegisterWizard.vue'

vi.mock('../../../services/auth/auth.service', async () => {
  const actual = await vi.importActual<typeof import('../../../services/auth/auth.service')>(
    '../../../services/auth/auth.service',
  )
  return { ...actual, registerUser: vi.fn(), loginUser: vi.fn(), googleLogin: vi.fn(), fetchCurrentUser: vi.fn() }
})

// Fuerza el boton de Google visible (por default queda apagado sin
// VITE_GOOGLE_CLIENT_ID, ver googleAuthConfig.ts) para poder probar el flujo
// completo del wizard despues de "Continuar con Google".
vi.mock('../../../utils/google/googleAuthConfig', () => ({ isGoogleSignInEnabled: true }))

const push = vi.fn()
vi.mock('vue-router', () => ({ useRouter: () => ({ push }) }))

// Token de Google de mentira: solo hace falta que el payload (segundo
// segmento, base64) decodifique a JSON con email/name - el wizard nunca
// verifica la firma en el frontend, eso lo hace el backend en el submit.
function makeFakeIdToken(claims: { email?: string; name?: string }): string {
  const header = btoa(JSON.stringify({ alg: 'none' }))
  const payload = btoa(JSON.stringify(claims))
  return `${header}.${payload}.signature`
}

const AUTH_RESULT = {
  accessToken: 'jwt-token',
  tokenType: 'bearer',
  user: { id: 'user-1', email: 'ash@example.com', displayName: null, defaultCurrency: 'USD', createdAt: '2026-01-01T00:00:00Z' },
}

function mountWizard() {
  return mount(RegisterWizard, {
    global: {
      stubs: {
        RouterLink: true,
        GoogleSignInButton: {
          template: '<button class="google-stub" type="button" @click="$emit(\'credential\', fakeToken)"></button>',
          data: () => ({ fakeToken: makeFakeIdToken({ email: 'ash@gmail.com', name: 'Ash' }) }),
        },
      },
    },
  })
}

async function fillStep1(wrapper: ReturnType<typeof mountWizard>, email = 'ash@example.com', password = 'clave12345') {
  await wrapper.find('input[type="email"]').setValue(email)
  await wrapper.find('input[type="password"]').setValue(password)
  await wrapper.find('form').trigger('submit')
}

async function addWallet(
  wrapper: ReturnType<typeof mountWizard>,
  { currency, name, balance }: { currency?: string; name?: string; balance?: string } = {},
) {
  if (currency) await wrapper.find('.wallet-form select').setValue(currency)
  if (name !== undefined) await wrapper.find('.wallet-form input[type="text"]').setValue(name)
  if (balance !== undefined) await wrapper.find('.wallet-form input[type="number"]').setValue(balance)
  await wrapper.find('.wallet-add-button').trigger('click')
}

describe('RegisterWizard', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    push.mockReset()
    vi.mocked(registerUser).mockReset()
    vi.mocked(googleLogin).mockReset()
  })

  it('arranca en el paso 1 con el boton deshabilitado hasta completar email y clave', async () => {
    const wrapper = mountWizard()

    expect(wrapper.text()).toContain('Crear cuenta')
    expect(wrapper.find('.wizard-next').attributes('disabled')).toBeDefined()

    await wrapper.find('input[type="email"]').setValue('ash@example.com')
    await wrapper.find('input[type="password"]').setValue('clave12345')

    expect(wrapper.find('.wizard-next').attributes('disabled')).toBeUndefined()
  })

  it('enviar el paso 1 avanza al paso de billeteras', async () => {
    const wrapper = mountWizard()

    await fillStep1(wrapper)

    expect(wrapper.text()).toContain('Tus billeteras')
  })

  it('el nombre de la billetera se autosugiere segun la moneda elegida', async () => {
    const wrapper = mountWizard()
    await fillStep1(wrapper)

    await wrapper.find('.wallet-form select').setValue('VEF')

    expect((wrapper.find('.wallet-form input[type="text"]').element as HTMLInputElement).value).toBe('Bolívar')
  })

  it('escribir un nombre propio deja de auto-sugerir al cambiar de moneda', async () => {
    const wrapper = mountWizard()
    await fillStep1(wrapper)

    await wrapper.find('.wallet-form input[type="text"]').setValue('Facebank')
    await wrapper.find('.wallet-form select').setValue('VEF')

    expect((wrapper.find('.wallet-form input[type="text"]').element as HTMLInputElement).value).toBe('Facebank')
  })

  it('agregar una billetera la suma a la lista y limpia el mini-formulario', async () => {
    const wrapper = mountWizard()
    await fillStep1(wrapper)

    await addWallet(wrapper, { currency: 'USD', name: 'Facebank', balance: '150.50' })

    expect(wrapper.findAll('.wallet-draft-item')).toHaveLength(1)
    expect(wrapper.find('.wallet-draft-name').text()).toBe('Facebank')
    expect((wrapper.find('.wallet-form input[type="text"]').element as HTMLInputElement).value).not.toBe('Facebank')
  })

  it('quitar una billetera agregada la saca de la lista', async () => {
    const wrapper = mountWizard()
    await fillStep1(wrapper)
    await addWallet(wrapper, { currency: 'USD', name: 'Facebank' })

    await wrapper.find('.wallet-draft-remove').trigger('click')

    expect(wrapper.findAll('.wallet-draft-item')).toHaveLength(0)
  })

  it('sin billeteras o con una sola moneda, el paso de moneda principal se saltea', async () => {
    const wrapper = mountWizard()
    await fillStep1(wrapper)

    await wrapper.find('.wizard-next').trigger('click') // "Saltear" sin agregar ninguna

    expect(wrapper.text()).toContain('Todo listo')
  })

  it('con billeteras en mas de una moneda, pregunta cual es la principal', async () => {
    const wrapper = mountWizard()
    await fillStep1(wrapper)
    await addWallet(wrapper, { currency: 'USD', name: 'Facebank' })
    await addWallet(wrapper, { currency: 'VEF', name: 'Banco de Venezuela' })

    await wrapper.find('.wizard-next').trigger('click')

    expect(wrapper.text()).toContain('¿Cuál es tu moneda principal?')
    const options = wrapper.findAll('.primary-currency-option').map((o) => o.text())
    expect(options).toEqual(['USD', 'VEF'])
  })

  it('volver desde el resumen cuando se salteo el paso 3 vuelve directo al paso 2', async () => {
    const wrapper = mountWizard()
    await fillStep1(wrapper)
    await wrapper.find('.wizard-next').trigger('click') // salteado directo a resumen

    await wrapper.find('.wizard-back').trigger('click')

    expect(wrapper.text()).toContain('Tus billeteras')
  })

  it('el resumen final envia la moneda principal elegida y las billeteras al registrarse', async () => {
    vi.mocked(registerUser).mockResolvedValue(AUTH_RESULT)
    const wrapper = mountWizard()
    await fillStep1(wrapper, 'ash@example.com', 'clave12345')
    await addWallet(wrapper, { currency: 'USD', name: 'Facebank', balance: '150.50' })
    await addWallet(wrapper, { currency: 'VEF', name: 'Banco de Venezuela' })
    await wrapper.find('.wizard-next').trigger('click') // a paso 3
    await wrapper.findAll('.primary-currency-option').find((o) => o.text() === 'VEF')!.trigger('click')
    await wrapper.find('.wizard-next').trigger('click') // a paso 4

    await wrapper.find('.wizard-next').trigger('click') // "Crear cuenta"
    await wrapper.vm.$nextTick()
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(registerUser).toHaveBeenCalledWith(
      'ash@example.com',
      'clave12345',
      undefined,
      'VEF',
      [
        { name: 'Facebank', currency: 'USD', initialBalance: 150.5 },
        { name: 'Banco de Venezuela', currency: 'VEF', initialBalance: 0 },
      ],
      undefined,
    )
    expect(push).toHaveBeenCalledWith({ name: 'dashboard' })
  })

  it('continuar con Google salta el correo/clave pero sigue con billeteras', async () => {
    const wrapper = mountWizard()

    await wrapper.find('.google-stub').trigger('click')

    expect(wrapper.text()).toContain('Tus billeteras')
  })

  it('el resumen usa el correo/nombre de Google y el submit llama a loginWithGoogle con billeteras y moneda', async () => {
    vi.mocked(googleLogin).mockResolvedValue({
      accessToken: 'jwt-token',
      tokenType: 'bearer',
      user: { id: 'user-1', email: 'ash@gmail.com', displayName: 'Ash', defaultCurrency: 'VEF', createdAt: '2026-01-01T00:00:00Z' },
    })
    const wrapper = mountWizard()

    await wrapper.find('.google-stub').trigger('click') // paso 2, sin pedir correo/clave
    await addWallet(wrapper, { currency: 'USD', name: 'Facebank', balance: '150.50' })
    await addWallet(wrapper, { currency: 'VEF', name: 'Banco de Venezuela' })
    await wrapper.find('.wizard-next').trigger('click') // a paso 3
    await wrapper.findAll('.primary-currency-option').find((o) => o.text() === 'VEF')!.trigger('click')
    await wrapper.find('.wizard-next').trigger('click') // a paso 4

    expect(wrapper.text()).toContain('ash@gmail.com')
    expect(wrapper.text()).toContain('Ash')

    await wrapper.find('.wizard-next').trigger('click') // "Crear cuenta"
    await wrapper.vm.$nextTick()
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(registerUser).not.toHaveBeenCalled()
    expect(googleLogin).toHaveBeenCalledWith(expect.stringContaining('.'), 'VEF', [
      { name: 'Facebank', currency: 'USD', initialBalance: 150.5 },
      { name: 'Banco de Venezuela', currency: 'VEF', initialBalance: 0 },
    ])
    expect(push).toHaveBeenCalledWith({ name: 'dashboard' })
  })

  it('si LoginForm dejo un credential pendiente en el store, arranca directo en billeteras', async () => {
    const store = useAuthStore()
    store.setPendingGoogleIdToken(makeFakeIdToken({ email: 'pendiente@gmail.com', name: 'Pendiente' }))

    const wrapper = mountWizard()
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('Tus billeteras')
  })

  it('el credential pendiente del store se consume una sola vez (no queda para el proximo mount)', () => {
    const store = useAuthStore()
    store.setPendingGoogleIdToken(makeFakeIdToken({ email: 'pendiente@gmail.com' }))

    mountWizard()

    expect(store.consumePendingGoogleIdToken()).toBeNull()
  })
})
