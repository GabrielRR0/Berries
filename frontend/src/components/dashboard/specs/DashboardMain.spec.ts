import { createPinia, setActivePinia } from 'pinia'
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useTransactionsStore } from '../../../stores/transactions.store'
import { useWalletsStore } from '../../../stores/wallets.store'
import DashboardMain from '../DashboardMain.vue'

const push = vi.fn()
vi.mock('vue-router', () => ({ useRouter: () => ({ push }) }))

const WALLET = { id: 'wallet-1', name: 'Efectivo', currency: 'USD', balance: 100, createdAt: '2026-01-01T00:00:00Z' }

function transaction(id: string, occurredAt: string, category: string) {
  return {
    id,
    walletId: 'wallet-1',
    type: 'expense' as const,
    amount: 10,
    category,
    description: null,
    occurredAt,
    source: 'manual',
    transferId: null,
    referenceAmountUsd: null,
    createdAt: occurredAt,
  }
}

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

// Idea de la sesion de brainstorm de UI: antes la unica forma de ver
// movimientos desde Inicio era abrir el sheet de Ingresos/Gastos (varios
// taps) - ahora hay un vistazo rapido de los ultimos 5, en modo readonly
// (sin Editar/Eliminar, ver TransactionList.vue).
describe('DashboardMain - "Últimos movimientos"', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    push.mockReset()
  })

  it('muestra el estado vacio cuando no hay movimientos', () => {
    const wrapper = mountDashboard()

    expect(wrapper.find('.recent-empty-text').text()).toBe('Todavía no registraste ningún movimiento.')
  })

  it('muestra como maximo los 5 movimientos mas recientes, ordenados por fecha', () => {
    useWalletsStore().wallets = [WALLET]
    useTransactionsStore().transactions = [
      transaction('tx-1', '2026-01-01T00:00:00Z', 'uno'),
      transaction('tx-2', '2026-01-05T00:00:00Z', 'cinco'),
      transaction('tx-3', '2026-01-03T00:00:00Z', 'tres'),
      transaction('tx-4', '2026-01-04T00:00:00Z', 'cuatro'),
      transaction('tx-5', '2026-01-02T00:00:00Z', 'dos'),
      transaction('tx-6', '2026-01-06T00:00:00Z', 'seis'),
    ]
    const wrapper = mountDashboard()

    const categories = wrapper.findAll('.transaction-category').map((el) => el.text())
    expect(categories).toEqual(['seis', 'cinco', 'cuatro', 'tres', 'dos'])
  })

  it('no muestra botones de Editar/Eliminar (modo readonly)', () => {
    useWalletsStore().wallets = [WALLET]
    useTransactionsStore().transactions = [transaction('tx-1', '2026-01-01T00:00:00Z', 'uno')]
    const wrapper = mountDashboard()

    expect(wrapper.find('.transaction-edit-trigger').exists()).toBe(false)
    expect(wrapper.find('.transaction-delete-trigger').exists()).toBe(false)
  })
})

// Idea de la sesion de brainstorm de UI: antes ambas secciones mostraban
// "vacio" en silencio mientras cargaban (indistinguible de "no hay datos")
// en vez de un indicador de carga explicito.
describe('DashboardMain - estados de carga', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    push.mockReset()
  })

  it('"Mis balances" muestra un indicador de carga mientras walletsStore.isLoading', () => {
    useWalletsStore().isLoading = true
    const wrapper = mountDashboard()

    expect(wrapper.text()).toContain('Cargando billeteras...')
    expect(wrapper.find('.wallets-empty').exists()).toBe(false)
  })

  it('"Últimos movimientos" muestra un indicador de carga mientras transactionsStore.isLoading', () => {
    useTransactionsStore().isLoading = true
    const wrapper = mountDashboard()

    expect(wrapper.text()).toContain('Cargando movimientos...')
    expect(wrapper.find('.recent-empty').exists()).toBe(false)
  })
})
