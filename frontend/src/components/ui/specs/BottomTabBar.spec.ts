import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useOfflineQueueStore } from '../../../stores/offlineQueue.store'
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
})
