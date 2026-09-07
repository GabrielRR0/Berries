import { createPinia, setActivePinia } from 'pinia'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { useToast } from '../../composables/toast/useToast'
import { addDebtPayment } from '../../services/debts/debts.service'
import { recordCheckIn } from '../../services/goals/goals.service'
import { createTransaction, TransactionsApiError } from '../../services/transactions/transactions.service'
import { transferBetweenWallets } from '../../services/wallets/wallets.service'
import { useTransactionsStore } from '../transactions.store'
import { useWalletsStore } from '../wallets.store'
import type { PendingTransaction } from '../offlineQueue.store'
import { useOfflineQueueStore } from '../offlineQueue.store'

vi.mock('../../services/transactions/transactions.service', () => ({
  createTransaction: vi.fn(),
  TransactionsApiError: class TransactionsApiError extends Error {
    status: number
    constructor(message: string, status: number) {
      super(message)
      this.status = status
    }
  },
}))

vi.mock('../../services/wallets/wallets.service', () => ({
  transferBetweenWallets: vi.fn(),
  WalletsApiError: class WalletsApiError extends Error {
    status: number
    constructor(message: string, status: number) {
      super(message)
      this.status = status
    }
  },
}))

vi.mock('../../services/debts/debts.service', () => ({
  addDebtPayment: vi.fn(),
  DebtsApiError: class DebtsApiError extends Error {
    status: number
    constructor(message: string, status: number) {
      super(message)
      this.status = status
    }
  },
}))

vi.mock('../../services/goals/goals.service', () => ({
  recordCheckIn: vi.fn(),
  GoalsApiError: class GoalsApiError extends Error {
    status: number
    constructor(message: string, status: number) {
      super(message)
      this.status = status
    }
  },
}))

function buildTransactionOp(): Omit<PendingTransaction, 'id' | 'status' | 'createdAt'> {
  return {
    kind: 'transaction',
    payload: {
      walletId: 'wallet-1',
      type: 'expense',
      amount: 1000,
      category: 'comida',
      description: 'Almuerzo',
    } as PendingTransaction['payload'],
    snapshot: {
      walletName: 'Efectivo',
      walletCurrency: 'CLP',
      type: 'expense',
      amount: 1000,
      category: 'comida',
      description: 'Almuerzo',
    },
  }
}

describe('offlineQueue.store', () => {
  beforeAll(() => {
    // useToast es un singleton de modulo (ver useToast.ts) - fake timers desde
    // el arranque de la suite para que el afterEach de abajo pueda drenar
    // cualquier toast que enqueue() dispare en CUALQUIER test de este archivo,
    // sin esperar 3.2s reales entre tests.
    vi.useFakeTimers()
  })

  afterAll(() => {
    vi.useRealTimers()
  })

  afterEach(() => {
    vi.advanceTimersByTime(10000)
  })

  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
    vi.mocked(createTransaction).mockReset()
    vi.mocked(transferBetweenWallets).mockReset()
    vi.mocked(addDebtPayment).mockReset()
    vi.mocked(recordCheckIn).mockReset()
    vi.spyOn(useWalletsStore(), 'fetchWallets').mockResolvedValue()
    vi.spyOn(useTransactionsStore(), 'fetchTransactions').mockResolvedValue()
  })

  it('encola un item nuevo en estado pending y lo persiste en localStorage', () => {
    const store = useOfflineQueueStore()

    const item = store.enqueue<PendingTransaction>(buildTransactionOp())

    expect(item.status).toBe('pending')
    expect(item.id).toBeTruthy()
    expect(store.items).toHaveLength(1)
    expect(store.pendingCount).toBe(1)
    const persisted = JSON.parse(localStorage.getItem('berry_offline_queue') ?? '[]')
    expect(persisted).toHaveLength(1)
    expect(persisted[0].id).toBe(item.id)
  })

  it('al encolar, avisa con un toast que quedo pendiente', () => {
    const store = useOfflineQueueStore()

    store.enqueue<PendingTransaction>(buildTransactionOp())

    expect(useToast().active.value?.text).toContain('pendiente')
  })

  it('al terminar syncAll con exito, avisa con un toast de sincronizado', async () => {
    vi.mocked(createTransaction).mockResolvedValue({} as never)
    const store = useOfflineQueueStore()
    store.enqueue<PendingTransaction>(buildTransactionOp())

    await store.syncAll()
    // El toast de "quedo pendiente" (disparado por enqueue) sigue activo hasta que
    // pasa su tiempo en pantalla - el de "se sincronizó" recien se muestra despues,
    // FIFO (ver useToast.ts).
    vi.advanceTimersByTime(3300)

    expect(useToast().active.value?.text).toContain('sincroniz')
    expect(useToast().active.value?.tone).toBe('success')
  })

  it('al terminar syncAll con un rechazo real, avisa con un toast de error', async () => {
    vi.mocked(createTransaction).mockRejectedValue(new TransactionsApiError('Rechazado', 400))
    const store = useOfflineQueueStore()
    store.enqueue<PendingTransaction>(buildTransactionOp())

    await store.syncAll()
    vi.advanceTimersByTime(3300)

    expect(useToast().active.value?.tone).toBe('error')
  })

  it('descarta un item por id', () => {
    const store = useOfflineQueueStore()
    const item = store.enqueue<PendingTransaction>(buildTransactionOp())

    store.discard(item.id)

    expect(store.items).toHaveLength(0)
    expect(JSON.parse(localStorage.getItem('berry_offline_queue') ?? '[]')).toHaveLength(0)
  })

  it('sincroniza con exito: llama al service, saca el item de la cola y refresca wallets/transactions', async () => {
    vi.mocked(createTransaction).mockResolvedValue({} as never)
    const store = useOfflineQueueStore()
    store.enqueue<PendingTransaction>(buildTransactionOp())

    await store.syncAll()

    expect(createTransaction).toHaveBeenCalledTimes(1)
    expect(store.items).toHaveLength(0)
    expect(useWalletsStore().fetchWallets).toHaveBeenCalledWith({ force: true })
    expect(useTransactionsStore().fetchTransactions).toHaveBeenCalledWith({ force: true })
  })

  it('si el service rechaza con un error real de API, marca el item failed y guarda el mensaje', async () => {
    vi.mocked(createTransaction).mockRejectedValue(new TransactionsApiError('Saldo invalido', 400))
    const store = useOfflineQueueStore()
    store.enqueue<PendingTransaction>(buildTransactionOp())

    await store.syncAll()

    expect(store.items).toHaveLength(1)
    expect(store.items[0].status).toBe('failed')
    expect(store.items[0].errorMessage).toBe('Saldo invalido')
  })

  it('si falla por conectividad (no es un ApiError tipado), el item vuelve a pending, no failed', async () => {
    vi.mocked(createTransaction).mockRejectedValue(new TypeError('Failed to fetch'))
    const store = useOfflineQueueStore()
    store.enqueue<PendingTransaction>(buildTransactionOp())

    await store.syncAll()

    expect(store.items).toHaveLength(1)
    expect(store.items[0].status).toBe('pending')
  })

  it('retry reintenta un item failed puntual', async () => {
    vi.mocked(createTransaction).mockRejectedValueOnce(new TransactionsApiError('Rechazado', 400))
    const store = useOfflineQueueStore()
    const item = store.enqueue<PendingTransaction>(buildTransactionOp())
    await store.syncAll()
    expect(store.items[0].status).toBe('failed')

    vi.mocked(createTransaction).mockResolvedValue({} as never)
    await store.retry(item.id)

    expect(store.items).toHaveLength(0)
  })

  it('syncAll no reintenta items ya failed', async () => {
    vi.mocked(createTransaction).mockRejectedValue(new TransactionsApiError('Rechazado', 400))
    const store = useOfflineQueueStore()
    store.enqueue<PendingTransaction>(buildTransactionOp())
    await store.syncAll()
    vi.mocked(createTransaction).mockClear()

    await store.syncAll()

    expect(createTransaction).not.toHaveBeenCalled()
  })

  it('rehidrata desde localStorage al crear el store, reseteando syncing a pending', () => {
    localStorage.setItem(
      'berry_offline_queue',
      JSON.stringify([{ ...buildTransactionOp(), id: 'abc', status: 'syncing', createdAt: '2026-01-01T00:00:00.000Z' }]),
    )

    const store = useOfflineQueueStore()

    expect(store.items).toHaveLength(1)
    expect(store.items[0].status).toBe('pending')
  })

  it('syncAll respeta orden FIFO por createdAt entre distintos tipos', async () => {
    vi.mocked(createTransaction).mockResolvedValue({} as never)
    vi.mocked(transferBetweenWallets).mockResolvedValue({} as never)
    const store = useOfflineQueueStore()
    const callOrder: string[] = []
    vi.mocked(transferBetweenWallets).mockImplementation(async () => {
      callOrder.push('transfer')
      return {} as never
    })
    vi.mocked(createTransaction).mockImplementation(async () => {
      callOrder.push('transaction')
      return {} as never
    })

    store.enqueue<PendingTransaction>(buildTransactionOp())
    store.items[0].createdAt = '2026-01-01T00:00:00.000Z'
    store.enqueue({
      kind: 'transfer',
      payload: { fromWalletId: 'w1', toWalletId: 'w2', amount: 500 } as never,
      snapshot: { fromWalletName: 'A', toWalletName: 'B', fromCurrency: 'CLP', toCurrency: 'CLP', amount: 500 },
    } as never)
    store.items[1].createdAt = '2025-12-31T00:00:00.000Z'

    await store.syncAll()

    expect(callOrder).toEqual(['transfer', 'transaction'])
  })
})
