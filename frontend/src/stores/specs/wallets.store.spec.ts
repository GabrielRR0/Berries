import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createWallet,
  deleteWallet,
  listWallets,
  transferBetweenWallets,
} from '../../services/wallets/wallets.service'
import { useTransactionsStore } from '../transactions.store'
import { useWalletsStore } from '../wallets.store'

vi.mock('../../services/wallets/wallets.service', async () => {
  const actual = await vi.importActual<typeof import('../../services/wallets/wallets.service')>(
    '../../services/wallets/wallets.service',
  )
  return {
    ...actual,
    createWallet: vi.fn(),
    listWallets: vi.fn(),
    deleteWallet: vi.fn(),
    transferBetweenWallets: vi.fn(),
  }
})

const WALLET_A = { id: 'wallet-1', name: 'Efectivo', currency: 'USD', balance: 100, createdAt: '2026-01-01T00:00:00Z' }
const WALLET_B = { id: 'wallet-2', name: 'Banco', currency: 'EUR', balance: 50, createdAt: '2026-01-01T00:00:00Z' }

describe('wallets.store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.mocked(createWallet).mockReset()
    vi.mocked(listWallets).mockReset()
    vi.mocked(deleteWallet).mockReset()
    vi.mocked(transferBetweenWallets).mockReset()
  })

  it('arranca con la lista vacia, sin cargar y sin error', () => {
    const store = useWalletsStore()

    expect(store.wallets).toEqual([])
    expect(store.isLoading).toBe(false)
    expect(store.error).toBeNull()
  })

  describe('fetchWallets', () => {
    it('carga la lista y refleja isLoading mientras esta en vuelo', async () => {
      vi.mocked(listWallets).mockResolvedValue([WALLET_A, WALLET_B])
      const store = useWalletsStore()

      const promise = store.fetchWallets()
      expect(store.isLoading).toBe(true)
      await promise

      expect(store.isLoading).toBe(false)
      expect(store.wallets).toEqual([WALLET_A, WALLET_B])
      expect(store.error).toBeNull()
    })

    it('guarda el mensaje de error y lo propaga si el service falla', async () => {
      vi.mocked(listWallets).mockRejectedValue(new Error('network error'))
      const store = useWalletsStore()

      await expect(store.fetchWallets()).rejects.toThrow('network error')

      expect(store.error).toBe('network error')
      expect(store.isLoading).toBe(false)
      expect(store.wallets).toEqual([])
    })

    // Pedido explicito del usuario: "guardar los datos cargados en cache...
    // asi cuando nos movamos de un lado a otro ya los montos esten
    // cargados, a menos que si requeria actualizar en casos concretos".
    it('no vuelve a pedir la lista si ya esta cargada y fresca', async () => {
      vi.mocked(listWallets).mockResolvedValue([WALLET_A])
      const store = useWalletsStore()

      await store.fetchWallets()
      await store.fetchWallets()

      expect(listWallets).toHaveBeenCalledTimes(1)
    })

    it('con force:true vuelve a pedir la lista aunque ya este fresca', async () => {
      vi.mocked(listWallets).mockResolvedValue([WALLET_A])
      const store = useWalletsStore()

      await store.fetchWallets()
      await store.fetchWallets({ force: true })

      expect(listWallets).toHaveBeenCalledTimes(2)
    })
  })

  describe('addWallet', () => {
    it('agrega la billetera creada a la lista existente', async () => {
      vi.mocked(listWallets).mockResolvedValue([WALLET_A])
      vi.mocked(createWallet).mockResolvedValue(WALLET_B)
      const store = useWalletsStore()
      await store.fetchWallets()

      await store.addWallet('Banco', 'EUR')

      expect(createWallet).toHaveBeenCalledWith('Banco', 'EUR', undefined)
      expect(store.wallets).toEqual([WALLET_A, WALLET_B])
    })

    it('reenvia el saldo inicial al service cuando se da', async () => {
      vi.mocked(listWallets).mockResolvedValue([])
      vi.mocked(createWallet).mockResolvedValue(WALLET_B)
      const store = useWalletsStore()
      await store.fetchWallets()

      await store.addWallet('Banco', 'EUR', 150.5)

      expect(createWallet).toHaveBeenCalledWith('Banco', 'EUR', 150.5)
    })

    it('propaga el error del service sin modificar la lista', async () => {
      vi.mocked(createWallet).mockRejectedValue(new Error('nombre invalido'))
      const store = useWalletsStore()

      await expect(store.addWallet('', 'USD')).rejects.toThrow('nombre invalido')

      expect(store.error).toBe('nombre invalido')
      expect(store.wallets).toEqual([])
    })
  })

  describe('removeWallet', () => {
    it('saca la billetera eliminada de la lista', async () => {
      vi.mocked(listWallets).mockResolvedValue([WALLET_A, WALLET_B])
      vi.mocked(deleteWallet).mockResolvedValue(undefined)
      const store = useWalletsStore()
      await store.fetchWallets()

      await store.removeWallet('wallet-1')

      expect(deleteWallet).toHaveBeenCalledWith('wallet-1')
      expect(store.wallets).toEqual([WALLET_B])
    })

    it('propaga el error del service sin modificar la lista', async () => {
      vi.mocked(listWallets).mockResolvedValue([WALLET_A])
      vi.mocked(deleteWallet).mockRejectedValue(new Error('No encontrada.'))
      const store = useWalletsStore()
      await store.fetchWallets()

      await expect(store.removeWallet('wallet-1')).rejects.toThrow('No encontrada.')

      expect(store.wallets).toEqual([WALLET_A])
    })
  })

  describe('transfer', () => {
    it('vuelve a pedir la lista de billeteras y de movimientos despues de transferir exitosamente', async () => {
      vi.mocked(transferBetweenWallets).mockResolvedValue({ fromWallet: WALLET_A, toWallet: WALLET_B })
      vi.mocked(listWallets).mockResolvedValue([WALLET_A, WALLET_B])
      const store = useWalletsStore()
      // El backend ahora registra la transferencia como dos movimientos (ver
      // transfer_service.py) - se espia la accion del OTRO store en vez de
      // mockear transactions.service entero, mismo criterio que
      // transactions.store.spec.ts usa para la direccion inversa.
      const fetchTransactionsSpy = vi.spyOn(useTransactionsStore(), 'fetchTransactions').mockResolvedValue()

      await store.transfer({ fromWalletId: 'wallet-1', toWalletId: 'wallet-2', amount: 10 })

      expect(transferBetweenWallets).toHaveBeenCalledWith({
        fromWalletId: 'wallet-1',
        toWalletId: 'wallet-2',
        amount: 10,
      })
      expect(listWallets).toHaveBeenCalled()
      expect(fetchTransactionsSpy).toHaveBeenCalledWith({ force: true })
      expect(store.wallets).toEqual([WALLET_A, WALLET_B])
    })

    it('propaga el error sin refrescar la lista si la transferencia falla', async () => {
      vi.mocked(transferBetweenWallets).mockRejectedValue(new Error('Fondos insuficientes.'))
      const store = useWalletsStore()

      await expect(store.transfer({ fromWalletId: 'wallet-1', toWalletId: 'wallet-2', amount: 999 })).rejects.toThrow(
        'Fondos insuficientes.',
      )

      expect(listWallets).not.toHaveBeenCalled()
      expect(store.error).toBe('Fondos insuficientes.')
    })
  })
})
