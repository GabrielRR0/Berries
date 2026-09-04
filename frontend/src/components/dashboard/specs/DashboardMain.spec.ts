import { createPinia, setActivePinia } from 'pinia'
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useWalletsStore } from '../../../stores/wallets.store'
import DashboardMain from '../DashboardMain.vue'

const push = vi.fn()
vi.mock('vue-router', () => ({ useRouter: () => ({ push }) }))

const WALLET = { id: 'wallet-1', name: 'Efectivo', currency: 'USD', balance: 100, createdAt: '2026-01-01T00:00:00Z' }

// BalanceCard/QuickActionsGrid/IncomeExpenseSummary tienen su propia logica
// (fetch de wallets/transactions, tour guiado) ya cubierta en sus propios
// specs - se stubean aca para aislar la lista "Mis balances", que vive
// directo en DashboardMain.vue y no en un componente propio.
function mountDashboard() {
  return mount(DashboardMain, {
    global: {
      stubs: { BalanceCard: true, QuickActionsGrid: true, IncomeExpenseSummary: true },
    },
  })
}

// Idea de la sesion de brainstorm de UI: hoy las filas de "Mis balances" en
// Inicio no hacen nada al tocarlas, a pesar de tener hover en escritorio -
// ahora navegan a /cuentas (WalletsMain.vue), donde vive el detalle real.
describe('DashboardMain - lista de "Mis balances"', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    push.mockReset()
  })

  it('tocar una fila de billetera navega a Cuentas', async () => {
    useWalletsStore().wallets = [WALLET]
    const wrapper = mountDashboard()

    await wrapper.find('.wallets-preview-item').trigger('click')

    expect(push).toHaveBeenCalledWith({ name: 'cuentas' })
  })

  it('la fila es accesible por teclado (Enter navega igual)', async () => {
    useWalletsStore().wallets = [WALLET]
    const wrapper = mountDashboard()
    const row = wrapper.find('.wallets-preview-item')

    expect(row.attributes('role')).toBe('button')
    expect(row.attributes('tabindex')).toBe('0')

    await row.trigger('keydown.enter')

    expect(push).toHaveBeenCalledWith({ name: 'cuentas' })
  })

  it('el boton "+" tambien navega a Cuentas', async () => {
    useWalletsStore().wallets = []
    const wrapper = mountDashboard()

    await wrapper.find('.wallets-fab').trigger('click')

    expect(push).toHaveBeenCalledWith({ name: 'cuentas' })
  })
})
