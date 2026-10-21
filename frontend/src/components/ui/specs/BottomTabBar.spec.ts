import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useOfflineQueueStore } from '../../../stores/offlineQueue.store'
import { useQuickRegister } from '../../../composables/quickRegister/useQuickRegister'
import BottomTabBar from '../BottomTabBar.vue'

vi.mock('vue-router', () => ({
  useRoute: () => ({ name: 'dashboard' }),
  useRouter: () => ({
    getRoutes: () => [
      { name: 'dashboard', path: '/', meta: { order: 0, tabBar: { label: 'Inicio', icon: 'home' } } },
      { name: 'movimientos', path: '/movimientos', meta: { order: 1, tabBar: { label: 'Movimientos', icon: 'movimientos' } } },
      { name: 'ajustes', path: '/ajustes', meta: { order: 7, tabBar: { label: 'Menú', icon: 'menu' } } },
    ],
  }),
  RouterLink: { template: '<a><slot /></a>' },
}))

function buildOp() {
  return {
    kind: 'transaction' as const,
    payload: { walletId: 'w1', type: 'expense', amount: 100, category: 'comida' } as never,
    snapshot: { walletName: 'Efectivo', walletCurrency: 'CLP', type: 'expense' as const, amount: 100, category: 'comida' },
  }
}

describe('BottomTabBar', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('no muestra el badge de pendientes en ningun tab si la cola esta vacia', () => {
    const wrapper = mount(BottomTabBar)

    expect(wrapper.find('.tab-pending-badge').exists()).toBe(false)
  })

  it('muestra el conteo de pendientes en el tab "Menú", no en "Inicio"', () => {
    useOfflineQueueStore().enqueue(buildOp())
    const wrapper = mount(BottomTabBar)

    const tabs = wrapper.findAll('.tab')
    const inicioTab = tabs[0]!
    const menuTab = tabs[tabs.length - 1]!

    expect(inicioTab.find('.tab-pending-badge').exists()).toBe(false)
    expect(menuTab.find('.tab-pending-badge').text()).toBe('1')
  })

  it('inserta el boton "+" de registrar movimiento en el centro, fuera de los tabs', () => {
    const wrapper = mount(BottomTabBar)

    const create = wrapper.find('.tab-create')
    expect(create.exists()).toBe(true)
    expect(create.attributes('aria-label')).toBe('Nuevo movimiento')

    // Inicio y Movimientos a la izquierda, Menu a la derecha: el "+" no es un
    // .tab (no es una seccion), asi que los 3 tabs siguen siendo 3.
    const children = Array.from(wrapper.find('nav').element.children)
    expect(wrapper.findAll('.tab')).toHaveLength(3)
    expect(children.indexOf(create.element)).toBe(2)
  })

  it('el boton "+" abre el panel Registrar sin navegar a ninguna ruta', async () => {
    const quickRegister = useQuickRegister()
    quickRegister.close()
    const wrapper = mount(BottomTabBar)

    await wrapper.find('.tab-create').trigger('click')

    expect(quickRegister.isOpen.value).toBe(true)
    expect(quickRegister.step.value).toBe('menu')
    quickRegister.close()
  })
})
