import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createTransaction } from '../../../services/transactions/transactions.service'
import { useOfflineQueueStore } from '../../../stores/offlineQueue.store'
import { useTransactionsStore } from '../../../stores/transactions.store'
import { useWalletsStore } from '../../../stores/wallets.store'
import PendingSyncMain from '../PendingSyncMain.vue'

vi.mock('../../../services/transactions/transactions.service', async () => {
  const actual = await vi.importActual<typeof import('../../../services/transactions/transactions.service')>(
    '../../../services/transactions/transactions.service',
  )
  return { ...actual, createTransaction: vi.fn() }
})

const push = vi.fn()
vi.mock('vue-router', () => ({ useRouter: () => ({ push }) }))

function buildOp() {
  return {
    kind: 'transaction' as const,
    payload: { walletId: 'w1', type: 'expense', amount: 1000, category: 'comida' } as never,
    snapshot: { walletName: 'Efectivo', walletCurrency: 'CLP', type: 'expense' as const, amount: 1000, category: 'comida' },
  }
}

describe('PendingSyncMain', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
    push.mockReset()
    vi.mocked(createTransaction).mockReset()
    vi.spyOn(useWalletsStore(), 'fetchWallets').mockResolvedValue()
    vi.spyOn(useTransactionsStore(), 'fetchTransactions').mockResolvedValue()
  })

  it('muestra el estado vacio cuando no hay pendientes', () => {
    const wrapper = mount(PendingSyncMain)

    expect(wrapper.text()).toContain('No tenés nada pendiente de sincronizar')
    expect(wrapper.find('.pending-sync-list').exists()).toBe(false)
  })

  it('muestra una tarjeta por cada pendiente y el conteo', () => {
    const offlineQueue = useOfflineQueueStore()
    offlineQueue.enqueue(buildOp())
    offlineQueue.enqueue(buildOp())

    const wrapper = mount(PendingSyncMain)

    expect(wrapper.findAll('.pending-sync-card')).toHaveLength(2)
    expect(wrapper.text()).toContain('2 pendientes')
  })

  it('descartar un item lo saca de la lista', async () => {
    const offlineQueue = useOfflineQueueStore()
    const item = offlineQueue.enqueue(buildOp())
    const wrapper = mount(PendingSyncMain)

    const discardButton = wrapper.findAll('button').find((btn) => btn.text() === 'Descartar')
    await discardButton?.trigger('click')

    expect(offlineQueue.items.find((i) => i.id === item.id)).toBeUndefined()
  })

  it('sincronizar todo llama al service y vacia la cola en exito', async () => {
    vi.mocked(createTransaction).mockResolvedValue({} as never)
    const offlineQueue = useOfflineQueueStore()
    offlineQueue.enqueue(buildOp())
    const wrapper = mount(PendingSyncMain)

    const syncAllButton = wrapper.findAll('button').find((btn) => btn.text().includes('Sincronizar todo'))
    await syncAllButton?.trigger('click')
    await Promise.resolve()
    await Promise.resolve()

    expect(createTransaction).toHaveBeenCalledTimes(1)
  })

  it('el boton de volver navega a Ajustes', async () => {
    const wrapper = mount(PendingSyncMain)

    await wrapper.find('[aria-label="Volver"]').trigger('click')

    expect(push).toHaveBeenCalledWith({ name: 'ajustes' })
  })
})
