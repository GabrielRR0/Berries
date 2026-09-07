import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  addDebtPayment,
  createDebt,
  deleteDebt,
  DebtsApiError,
  deleteDebtPayment,
  getDebtSummary,
  listDebts,
  payInstallment,
  unpayInstallment,
} from '../../../services/debts/debts.service'
import type { Debt, DebtPayment, DebtSummary } from '../../../services/debts/interfaces/debts.interface'
import * as secureCache from '../../../utils/offlineCache/secureCache'
import { useOfflineCachePreferencesStore } from '../../../stores/offlineCachePreferences.store'
import { useDebts } from '../useDebts'

vi.mock('../../../services/debts/debts.service', () => ({
  listDebts: vi.fn(),
  getDebtSummary: vi.fn(),
  createDebt: vi.fn(),
  deleteDebt: vi.fn(),
  payInstallment: vi.fn(),
  unpayInstallment: vi.fn(),
  addDebtPayment: vi.fn(),
  deleteDebtPayment: vi.fn(),
  DebtsApiError: class DebtsApiError extends Error {
    status: number
    constructor(message: string, status: number) {
      super(message)
      this.status = status
    }
  },
}))

vi.mock('../../../utils/offlineCache/secureCache', () => ({
  readCache: vi.fn(),
  writeCache: vi.fn(),
  clearCacheByPrefix: vi.fn(),
}))

const DEBT: Debt = {
  id: 'debt-1',
  userId: 'user-1',
  counterpartyName: 'Juan Pérez',
  direction: 'owed_to_user',
  totalAmount: 300,
  currency: 'USD',
  description: null,
  createdAt: '2026-08-01T00:00:00Z',
  installments: [],
  payments: [],
  amountPaid: 0,
  remainingAmount: 300,
}

const PAYMENT: DebtPayment = {
  id: 'payment-1',
  debtId: 'debt-1',
  amount: 50,
  currency: 'USD',
  appliedAmount: 50,
  note: null,
  paidAt: '2026-08-30',
  walletId: null,
  createdAt: '2026-08-30T00:00:00Z',
}

const SUMMARY: DebtSummary = { totalOwedByUser: 0, totalOwedToUser: 300 }

describe('useDebts', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
    vi.mocked(listDebts).mockReset().mockResolvedValue([DEBT])
    vi.mocked(getDebtSummary).mockReset().mockResolvedValue(SUMMARY)
    vi.mocked(createDebt).mockReset()
    vi.mocked(deleteDebt).mockReset()
    vi.mocked(payInstallment).mockReset()
    vi.mocked(unpayInstallment).mockReset()
    vi.mocked(addDebtPayment).mockReset()
    vi.mocked(deleteDebtPayment).mockReset()
    vi.mocked(secureCache.readCache).mockReset().mockResolvedValue(null)
    vi.mocked(secureCache.writeCache).mockReset().mockResolvedValue(undefined)
  })

  it('arranca vacio, sin cargar y sin error', () => {
    const { debts, summary, isLoading, error } = useDebts()

    expect(debts.value).toEqual([])
    expect(summary.value).toBeNull()
    expect(isLoading.value).toBe(false)
    expect(error.value).toBeNull()
  })

  describe('fetchDebts', () => {
    it('pide la lista y la guarda, pasando isLoading por true y de vuelta a false', async () => {
      const { debts, isLoading, fetchDebts } = useDebts()

      const promise = fetchDebts()
      expect(isLoading.value).toBe(true)
      await promise

      expect(listDebts).toHaveBeenCalledWith(undefined)
      expect(debts.value).toEqual([DEBT])
      expect(isLoading.value).toBe(false)
    })

    it('pasa el direction al servicio', async () => {
      const { fetchDebts } = useDebts()

      await fetchDebts('owed_by_user')

      expect(listDebts).toHaveBeenCalledWith('owed_by_user')
    })

    it('guarda el mensaje de error si el backend rechaza el pedido', async () => {
      vi.mocked(listDebts).mockRejectedValue(new DebtsApiError('no autorizado', 401))
      const { debts, error, fetchDebts } = useDebts()

      await fetchDebts()

      expect(error.value).toBe('no autorizado')
      expect(debts.value).toEqual([])
    })

    it('sin cache guardada, una falla de conexion no llena error (deja la lista vacia)', async () => {
      vi.mocked(listDebts).mockRejectedValue(new TypeError('Failed to fetch'))
      const { debts, error, fetchDebts } = useDebts()

      await fetchDebts()

      expect(error.value).toBeNull()
      expect(debts.value).toEqual([])
    })

    it('con la cache habilitada, un fetch exitoso la escribe', async () => {
      useOfflineCachePreferencesStore().setPreference('debts', true)
      const { fetchDebts } = useDebts()

      await fetchDebts()

      expect(secureCache.writeCache).toHaveBeenCalledWith('berry_cache_debts_list', [DEBT])
    })

    it('con la cache habilitada, una falla de conexion sirve lo guardado en cache', async () => {
      useOfflineCachePreferencesStore().setPreference('debts', true)
      vi.mocked(secureCache.readCache).mockResolvedValue([DEBT])
      vi.mocked(listDebts).mockRejectedValue(new TypeError('Failed to fetch'))
      const { debts, fetchDebts } = useDebts()

      await fetchDebts()

      expect(debts.value).toEqual([DEBT])
    })
  })

  describe('fetchSummary', () => {
    it('pide el resumen y lo guarda', async () => {
      const { summary, fetchSummary } = useDebts()

      await fetchSummary()

      expect(summary.value).toEqual(SUMMARY)
    })

    it('con la cache habilitada, una falla de conexion sirve el resumen guardado en cache', async () => {
      useOfflineCachePreferencesStore().setPreference('debts', true)
      vi.mocked(secureCache.readCache).mockResolvedValue(SUMMARY)
      vi.mocked(getDebtSummary).mockRejectedValue(new TypeError('Failed to fetch'))
      const { summary, fetchSummary } = useDebts()

      await fetchSummary()

      expect(summary.value).toEqual(SUMMARY)
    })
  })

  describe('create', () => {
    it('crea la deuda y refresca lista + resumen', async () => {
      vi.mocked(createDebt).mockResolvedValue(DEBT)
      const { debts, summary, create } = useDebts()

      await create({
        counterpartyName: 'Juan Pérez',
        direction: 'owed_to_user',
        totalAmount: 300,
        currency: 'USD',
      })

      expect(createDebt).toHaveBeenCalled()
      expect(listDebts).toHaveBeenCalled()
      expect(getDebtSummary).toHaveBeenCalled()
      expect(debts.value).toEqual([DEBT])
      expect(summary.value).toEqual(SUMMARY)
    })

    it('propaga el error sin dejar isLoading colgado', async () => {
      vi.mocked(createDebt).mockRejectedValue(new Error('monto inválido'))
      const { isLoading, error, create } = useDebts()

      await expect(
        create({ counterpartyName: 'X', direction: 'owed_to_user', totalAmount: -1, currency: 'USD' }),
      ).rejects.toThrow('monto inválido')

      expect(error.value).toBe('monto inválido')
      expect(isLoading.value).toBe(false)
    })

    it('refresca con el mismo filtro que estaba activo', async () => {
      vi.mocked(createDebt).mockResolvedValue(DEBT)
      const { fetchDebts, create } = useDebts()

      await fetchDebts('owed_by_user')
      vi.mocked(listDebts).mockClear()

      await create({ counterpartyName: 'X', direction: 'owed_by_user', totalAmount: 10, currency: 'USD' })

      expect(listDebts).toHaveBeenCalledWith('owed_by_user')
    })
  })

  describe('remove', () => {
    it('elimina la deuda y refresca lista + resumen', async () => {
      const { remove } = useDebts()

      await remove('debt-1')

      expect(deleteDebt).toHaveBeenCalledWith('debt-1')
      expect(listDebts).toHaveBeenCalled()
      expect(getDebtSummary).toHaveBeenCalled()
    })

    it('propaga el error del servicio', async () => {
      vi.mocked(deleteDebt).mockRejectedValue(new Error('no encontrada'))
      const { error, remove } = useDebts()

      await expect(remove('missing')).rejects.toThrow('no encontrada')
      expect(error.value).toBe('no encontrada')
    })
  })

  describe('payInstallment', () => {
    it('marca la cuota como pagada y refresca la lista', async () => {
      const { payInstallment: pay } = useDebts()

      await pay('debt-1', 'inst-1')

      expect(payInstallment).toHaveBeenCalledWith('debt-1', 'inst-1')
      expect(listDebts).toHaveBeenCalled()
    })
  })

  describe('unpayInstallment', () => {
    it('revierte el pago y refresca la lista', async () => {
      const { unpayInstallment: unpay } = useDebts()

      await unpay('debt-1', 'inst-1')

      expect(unpayInstallment).toHaveBeenCalledWith('debt-1', 'inst-1')
      expect(listDebts).toHaveBeenCalled()
    })

    it('propaga el error del servicio', async () => {
      vi.mocked(unpayInstallment).mockRejectedValue(new Error('no se pudo revertir'))
      const { error, unpayInstallment: unpay } = useDebts()

      await expect(unpay('debt-1', 'inst-1')).rejects.toThrow('no se pudo revertir')
      expect(error.value).toBe('no se pudo revertir')
    })
  })

  describe('addPayment', () => {
    it('registra el pago y refresca la lista', async () => {
      vi.mocked(addDebtPayment).mockResolvedValue(PAYMENT)
      const { addPayment } = useDebts()

      await addPayment('debt-1', { amount: 50, currency: 'USD' })

      expect(addDebtPayment).toHaveBeenCalledWith('debt-1', { amount: 50, currency: 'USD' })
      expect(listDebts).toHaveBeenCalled()
      expect(getDebtSummary).toHaveBeenCalled()
    })

    it('propaga el error del servicio', async () => {
      vi.mocked(addDebtPayment).mockRejectedValue(new Error('saldo insuficiente'))
      const { error, addPayment } = useDebts()

      await expect(addPayment('debt-1', { amount: 50, currency: 'USD' })).rejects.toThrow('saldo insuficiente')
      expect(error.value).toBe('saldo insuficiente')
    })
  })

  describe('removePayment', () => {
    it('elimina el pago y refresca la lista', async () => {
      const { removePayment } = useDebts()

      await removePayment('debt-1', 'payment-1')

      expect(deleteDebtPayment).toHaveBeenCalledWith('debt-1', 'payment-1')
      expect(listDebts).toHaveBeenCalled()
    })

    it('propaga el error del servicio', async () => {
      vi.mocked(deleteDebtPayment).mockRejectedValue(new Error('no encontrado'))
      const { error, removePayment } = useDebts()

      await expect(removePayment('debt-1', 'missing')).rejects.toThrow('no encontrado')
      expect(error.value).toBe('no encontrado')
    })
  })
})
