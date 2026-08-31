import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createDebt,
  deleteDebt,
  getDebtSummary,
  listDebts,
  payInstallment,
  unpayInstallment,
} from '../../../services/debts/debts.service'
import type { Debt, DebtSummary } from '../../../services/debts/interfaces/debts.interface'
import { useDebts } from '../useDebts'

vi.mock('../../../services/debts/debts.service', () => ({
  listDebts: vi.fn(),
  getDebtSummary: vi.fn(),
  createDebt: vi.fn(),
  deleteDebt: vi.fn(),
  payInstallment: vi.fn(),
  unpayInstallment: vi.fn(),
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
}

const SUMMARY: DebtSummary = { totalOwedByUser: 0, totalOwedToUser: 300 }

describe('useDebts', () => {
  beforeEach(() => {
    vi.mocked(listDebts).mockReset().mockResolvedValue([DEBT])
    vi.mocked(getDebtSummary).mockReset().mockResolvedValue(SUMMARY)
    vi.mocked(createDebt).mockReset()
    vi.mocked(deleteDebt).mockReset()
    vi.mocked(payInstallment).mockReset()
    vi.mocked(unpayInstallment).mockReset()
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

    it('guarda el mensaje de error si el servicio falla', async () => {
      vi.mocked(listDebts).mockRejectedValue(new Error('fallo de red'))
      const { debts, error, fetchDebts } = useDebts()

      await fetchDebts()

      expect(error.value).toBe('fallo de red')
      expect(debts.value).toEqual([])
    })
  })

  describe('fetchSummary', () => {
    it('pide el resumen y lo guarda', async () => {
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
})
