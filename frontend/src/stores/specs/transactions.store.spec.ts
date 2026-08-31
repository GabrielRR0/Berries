import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { deleteTransaction, listTransactions } from '../../services/transactions/transactions.service'
import { useWalletsStore } from '../wallets.store'
import { useTransactionsStore } from '../transactions.store'

vi.mock('../../services/transactions/transactions.service', async () => {
  const actual = await vi.importActual<typeof import('../../services/transactions/transactions.service')>(
    '../../services/transactions/transactions.service',
  )
  return { ...actual, listTransactions: vi.fn(), deleteTransaction: vi.fn() }
})

const TX_A = {
  id: 'tx-1',
  walletId: 'wallet-1',
  type: 'income' as const,
  amount: 500,
  category: 'Sueldo',
  description: null,
  occurredAt: '2026-08-01T00:00:00Z',
  source: 'manual',
  transferId: null,
  createdAt: '2026-08-01T00:00:00Z',
}
const TX_B = {
  id: 'tx-2',
  walletId: 'wallet-1',
  type: 'expense' as const,
  amount: 40,
  category: 'Transporte',
  description: null,
  occurredAt: '2026-08-02T00:00:00Z',
  source: 'manual',
  transferId: null,
  createdAt: '2026-08-02T00:00:00Z',
}

describe('transactions.store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.mocked(listTransactions).mockReset()
    vi.mocked(deleteTransaction).mockReset()
  })

  it('arranca vacio, sin cargar y sin error', () => {
    const store = useTransactionsStore()
    expect(store.transactions).toEqual([])
    expect(store.isLoading).toBe(false)
    expect(store.error).toBeNull()
  })

  describe('fetchTransactions', () => {
    it('carga la lista completa (sin filtro de fecha)', async () => {
      vi.mocked(listTransactions).mockResolvedValue([TX_A, TX_B])
      const store = useTransactionsStore()

      await store.fetchTransactions()

      expect(listTransactions).toHaveBeenCalledWith()
      expect(store.transactions).toEqual([TX_A, TX_B])
    })

    // Pedido explicito del usuario: "guardar los datos cargados en cache...
    // asi cuando nos movamos de un lado a otro ya los montos esten
    // cargados, a menos que si requeria actualizar en casos concretos".
    it('no vuelve a pedir la lista si ya esta cargada y fresca', async () => {
      vi.mocked(listTransactions).mockResolvedValue([TX_A])
      const store = useTransactionsStore()

      await store.fetchTransactions()
      await store.fetchTransactions()

      expect(listTransactions).toHaveBeenCalledTimes(1)
    })

    it('con force:true vuelve a pedir la lista aunque ya este fresca', async () => {
      vi.mocked(listTransactions).mockResolvedValue([TX_A])
      const store = useTransactionsStore()

      await store.fetchTransactions()
      await store.fetchTransactions({ force: true })

      expect(listTransactions).toHaveBeenCalledTimes(2)
    })

    it('guarda el mensaje de error y lo propaga si el service falla', async () => {
      vi.mocked(listTransactions).mockRejectedValue(new Error('network error'))
      const store = useTransactionsStore()

      await expect(store.fetchTransactions()).rejects.toThrow('network error')
      expect(store.error).toBe('network error')
    })
  })

  // Estos dos son los "casos concretos" que el usuario pidio exceptuar de
  // la cache: cambian el balance real de una wallet, asi que ademas de
  // sincronizar la cache de movimientos fuerzan un refresh de wallets.
  describe('removeTransaction', () => {
    it('elimina contra el backend, saca el item de la cache y fuerza un refresh de wallets', async () => {
      vi.mocked(listTransactions).mockResolvedValue([TX_A, TX_B])
      vi.mocked(deleteTransaction).mockResolvedValue(undefined)
      const walletsStore = useWalletsStore()
      const fetchWalletsSpy = vi.spyOn(walletsStore, 'fetchWallets').mockResolvedValue()
      const store = useTransactionsStore()
      await store.fetchTransactions()

      await store.removeTransaction('tx-1')

      expect(deleteTransaction).toHaveBeenCalledWith('tx-1')
      expect(store.transactions).toEqual([TX_B])
      expect(fetchWalletsSpy).toHaveBeenCalledWith({ force: true })
    })

    // El backend borra las dos patas de una transferencia juntas (mismo
    // transfer_id, ver transaction_service.delete_transaction) - la cache
    // local tiene que sacar tambien la otra pata, no solo la que se pidio
    // borrar, o quedaria mostrando un movimiento que ya no existe.
    it('al eliminar una pata de una transferencia, saca tambien la otra pata de la cache', async () => {
      const transferExpenseLeg = { ...TX_B, id: 'tx-transfer-out', transferId: 'transfer-1', source: 'transfer' }
      const transferIncomeLeg = { ...TX_A, id: 'tx-transfer-in', transferId: 'transfer-1', source: 'transfer' }
      vi.mocked(listTransactions).mockResolvedValue([TX_A, transferExpenseLeg, transferIncomeLeg])
      vi.mocked(deleteTransaction).mockResolvedValue(undefined)
      vi.spyOn(useWalletsStore(), 'fetchWallets').mockResolvedValue()
      const store = useTransactionsStore()
      await store.fetchTransactions()

      await store.removeTransaction('tx-transfer-out')

      expect(deleteTransaction).toHaveBeenCalledWith('tx-transfer-out')
      expect(store.transactions).toEqual([TX_A])
    })
  })

  describe('recordCreated', () => {
    it('agrega el movimiento ya creado a la cache y fuerza un refresh de wallets', () => {
      const walletsStore = useWalletsStore()
      const fetchWalletsSpy = vi.spyOn(walletsStore, 'fetchWallets').mockResolvedValue()
      const store = useTransactionsStore()

      store.recordCreated(TX_A)

      expect(store.transactions).toEqual([TX_A])
      expect(fetchWalletsSpy).toHaveBeenCalledWith({ force: true })
    })
  })
})
