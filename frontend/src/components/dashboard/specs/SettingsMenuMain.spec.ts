import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { deleteAccount } from '../../../services/auth/auth.service'
import { useAuthStore } from '../../../stores/auth.store'
import SettingsMenuMain from '../SettingsMenuMain.vue'

vi.mock('../../../services/auth/auth.service', async () => {
  const actual = await vi.importActual<typeof import('../../../services/auth/auth.service')>(
    '../../../services/auth/auth.service',
  )
  return { ...actual, deleteAccount: vi.fn() }
})

const push = vi.fn()
vi.mock('vue-router', () => ({ useRouter: () => ({ push }) }))

function mountSettings() {
  return mount(SettingsMenuMain, { global: { stubs: { RouterLink: true } } })
}

// Idea de la sesion de brainstorm de UI: esta era la unica pantalla
// secundaria sin titulo visible ni "?" de ayuda (rompia el patron de
// SectionHeader que ya siguen Metas/Deudas/Movimientos), y su lista de
// enlaces no tenia iconos.
describe('SettingsMenuMain - header e iconos', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    push.mockReset()
  })

  it('muestra el titulo "Menú" y navega al dashboard al volver', async () => {
    const wrapper = mountSettings()

    expect(wrapper.find('.section-header-title').text()).toBe('Menú')

    await wrapper.find('button[aria-label="Volver"]').trigger('click')

    expect(push).toHaveBeenCalledWith({ name: 'dashboard' })
  })

  it('el "?" abre la explicacion de la pantalla', async () => {
    const wrapper = mountSettings()

    await wrapper.find('button[aria-label="¿Qué es esta sección?"]').trigger('click')

    expect(wrapper.text()).toContain('¿Qué es Menú?')
  })

  it('agrupa los enlaces en "Tus finanzas" y "Herramientas"', () => {
    const wrapper = mountSettings()

    const labels = wrapper.findAll('.menu-section-label').map((el) => el.text())
    expect(labels).toEqual(['Tus finanzas', 'Herramientas'])
  })

  it('cada item del menu tiene un icono propio', () => {
    // Sin stubear RouterLink aca (a diferencia de mountSettings()): el stub
    // global descarta el contenido de sus slots, asi que nunca dejaria ver
    // si el icono realmente se renderiza adentro.
    setActivePinia(createPinia())
    const wrapper = mount(SettingsMenuMain)

    const items = wrapper.findAll('.menu-item')
    expect(items).toHaveLength(5)
    for (const item of items) {
      expect(item.find('.icon-badge svg').exists()).toBe(true)
    }
  })
})

describe('SettingsMenuMain - eliminar cuenta', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    push.mockReset()
    vi.mocked(deleteAccount).mockReset()
  })

  function loginAs(email: string) {
    const store = useAuthStore()
    store.token = 'jwt-token'
    store.user = { id: 'user-1', email, displayName: null, defaultCurrency: 'USD', createdAt: '2026-01-01T00:00:00Z' }
    return store
  }

  it('el boton de confirmar borrado esta deshabilitado hasta escribir el correo exacto', async () => {
    loginAs('ash@example.com')
    const wrapper = mountSettings()

    await wrapper.find('.delete-account-trigger').trigger('click')

    const confirmButton = wrapper.find('.delete-confirm-button')
    expect(confirmButton.attributes('disabled')).toBeDefined()

    await wrapper.find('.field input').setValue('otro@example.com')
    expect(wrapper.find('.delete-confirm-button').attributes('disabled')).toBeDefined()

    await wrapper.find('.field input').setValue('ash@example.com')
    expect(wrapper.find('.delete-confirm-button').attributes('disabled')).toBeUndefined()
  })

  it('confirmar el borrado llama a deleteOwnAccount y redirige a login', async () => {
    loginAs('ash@example.com')
    vi.mocked(deleteAccount).mockResolvedValue(undefined)
    const wrapper = mountSettings()

    await wrapper.find('.delete-account-trigger').trigger('click')
    await wrapper.find('.field input').setValue('ash@example.com')
    await wrapper.find('.delete-confirm-button').trigger('click')
    await wrapper.vm.$nextTick()
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(deleteAccount).toHaveBeenCalledWith('jwt-token')
    expect(push).toHaveBeenCalledWith({ name: 'login' })
  })

  it('muestra un error si el borrado falla y no redirige', async () => {
    loginAs('ash@example.com')
    vi.mocked(deleteAccount).mockRejectedValue(new Error('No se pudo eliminar la cuenta.'))
    const wrapper = mountSettings()

    await wrapper.find('.delete-account-trigger').trigger('click')
    await wrapper.find('.field input').setValue('ash@example.com')
    await wrapper.find('.delete-confirm-button').trigger('click')
    await wrapper.vm.$nextTick()
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(wrapper.text()).toContain('No se pudo eliminar la cuenta.')
    expect(push).not.toHaveBeenCalled()
  })

  it('cancelar cierra el sheet sin llamar al servicio', async () => {
    loginAs('ash@example.com')
    const wrapper = mountSettings()

    await wrapper.find('.delete-account-trigger').trigger('click')
    expect(wrapper.text()).toContain('Eliminar cuenta')

    await wrapper.findAll('button').find((b) => b.text() === 'Cancelar')!.trigger('click')

    expect(deleteAccount).not.toHaveBeenCalled()
    expect(wrapper.find('.delete-confirm-button').exists()).toBe(false)
  })
})
