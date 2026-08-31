import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  abandonGoal,
  createGoal,
  deleteGoal,
  getGoalSummary,
  getPendingCheckIns,
  getSavingsCapacity,
  listGoals,
  recordCheckIn,
  updateGoal,
} from '../../../services/goals/goals.service'
import type { Goal, GoalSummary, PendingCheckIn, SavingsCapacity } from '../../../services/goals/interfaces/goals.interface'
import { useGoals } from '../useGoals'

vi.mock('../../../services/goals/goals.service', () => ({
  listGoals: vi.fn(),
  getGoalSummary: vi.fn(),
  getPendingCheckIns: vi.fn(),
  getSavingsCapacity: vi.fn(),
  createGoal: vi.fn(),
  updateGoal: vi.fn(),
  deleteGoal: vi.fn(),
  recordCheckIn: vi.fn(),
  abandonGoal: vi.fn(),
}))

const GOAL: Goal = {
  id: 'goal-1',
  userId: 'user-1',
  title: 'TV',
  targetAmount: 240,
  currency: 'USD',
  targetDate: '2026-11-28',
  totalSaved: 80,
  status: 'active',
  goalType: 'custom',
  createdAt: '2026-08-01T00:00:00Z',
  completedAt: null,
  suggestedMonthlyContribution: 53.33,
  lastCheckInPostponed: false,
}

const SUMMARY: GoalSummary = { totalSaved: 80, totalTarget: 240 }

const PENDING: PendingCheckIn = {
  goalId: 'goal-1',
  title: 'TV',
  currency: 'USD',
  targetDate: '2026-11-28',
  suggestedAmount: 53.33,
}

const CAPACITY: SavingsCapacity = { avgMonthlyIncome: 900, avgMonthlyExpense: 600, avgMonthlyAvailable: 300 }

describe('useGoals', () => {
  beforeEach(() => {
    vi.mocked(listGoals).mockReset().mockResolvedValue([GOAL])
    vi.mocked(getGoalSummary).mockReset().mockResolvedValue(SUMMARY)
    vi.mocked(getPendingCheckIns).mockReset().mockResolvedValue([PENDING])
    vi.mocked(getSavingsCapacity).mockReset().mockResolvedValue(CAPACITY)
    vi.mocked(createGoal).mockReset()
    vi.mocked(updateGoal).mockReset()
    vi.mocked(deleteGoal).mockReset()
    vi.mocked(recordCheckIn).mockReset()
    vi.mocked(abandonGoal).mockReset()
  })

  it('arranca vacio, sin cargar y sin error', () => {
    const { goals, summary, pendingCheckIns, savingsCapacity, isLoading, error } = useGoals()

    expect(goals.value).toEqual([])
    expect(summary.value).toBeNull()
    expect(pendingCheckIns.value).toEqual([])
    expect(savingsCapacity.value).toBeNull()
    expect(isLoading.value).toBe(false)
    expect(error.value).toBeNull()
  })

  describe('fetchGoals', () => {
    it('pide la lista y la guarda, pasando isLoading por true y de vuelta a false', async () => {
      const { goals, isLoading, fetchGoals } = useGoals()

      const promise = fetchGoals()
      expect(isLoading.value).toBe(true)
      await promise

      expect(listGoals).toHaveBeenCalledWith(undefined)
      expect(goals.value).toEqual([GOAL])
      expect(isLoading.value).toBe(false)
    })

    it('pasa el status al servicio', async () => {
      const { fetchGoals } = useGoals()

      await fetchGoals('completed')

      expect(listGoals).toHaveBeenCalledWith('completed')
    })

    it('guarda el mensaje de error si el servicio falla', async () => {
      vi.mocked(listGoals).mockRejectedValue(new Error('fallo de red'))
      const { goals, error, fetchGoals } = useGoals()

      await fetchGoals()

      expect(error.value).toBe('fallo de red')
      expect(goals.value).toEqual([])
    })
  })

  describe('fetchSummary', () => {
    it('pide el resumen y lo guarda', async () => {
      const { summary, fetchSummary } = useGoals()

      await fetchSummary()

      expect(summary.value).toEqual(SUMMARY)
    })
  })

  describe('fetchPendingCheckIns', () => {
    it('pide los chequeos pendientes y los guarda', async () => {
      const { pendingCheckIns, fetchPendingCheckIns } = useGoals()

      await fetchPendingCheckIns()

      expect(pendingCheckIns.value).toEqual([PENDING])
    })
  })

  describe('create', () => {
    it('crea la meta y refresca lista + resumen + chequeos pendientes', async () => {
      vi.mocked(createGoal).mockResolvedValue(GOAL)
      const { goals, summary, pendingCheckIns, create } = useGoals()

      await create({ title: 'TV', targetAmount: 240, currency: 'USD', targetDate: '2026-11-28', goalType: 'custom' })

      expect(createGoal).toHaveBeenCalled()
      expect(listGoals).toHaveBeenCalled()
      expect(getGoalSummary).toHaveBeenCalled()
      expect(getPendingCheckIns).toHaveBeenCalled()
      expect(goals.value).toEqual([GOAL])
      expect(summary.value).toEqual(SUMMARY)
      expect(pendingCheckIns.value).toEqual([PENDING])
    })

    it('propaga el error sin dejar isLoading colgado', async () => {
      vi.mocked(createGoal).mockRejectedValue(new Error('monto inválido'))
      const { isLoading, error, create } = useGoals()

      await expect(
        create({ title: 'X', targetAmount: -1, currency: 'USD', targetDate: '2026-11-28', goalType: 'custom' }),
      ).rejects.toThrow('monto inválido')

      expect(error.value).toBe('monto inválido')
      expect(isLoading.value).toBe(false)
    })

    it('refresca con el mismo filtro que estaba activo', async () => {
      vi.mocked(createGoal).mockResolvedValue(GOAL)
      const { fetchGoals, create } = useGoals()

      await fetchGoals('completed')
      vi.mocked(listGoals).mockClear()

      await create({ title: 'X', targetAmount: 10, currency: 'USD', targetDate: '2026-11-28', goalType: 'custom' })

      expect(listGoals).toHaveBeenCalledWith('completed')
    })
  })

  describe('fetchSavingsCapacity', () => {
    it('pide el promedio de ingresos/gastos y lo guarda', async () => {
      const { savingsCapacity, fetchSavingsCapacity } = useGoals()

      await fetchSavingsCapacity()

      expect(savingsCapacity.value).toEqual(CAPACITY)
    })
  })

  describe('update', () => {
    it('edita la meta y refresca lista + resumen + chequeos pendientes', async () => {
      vi.mocked(updateGoal).mockResolvedValue(GOAL)
      const { goals, update } = useGoals()

      await update('goal-1', { title: 'MacBook', targetAmount: 1200, currency: 'EUR', targetDate: '2027-02-28' })

      expect(updateGoal).toHaveBeenCalledWith('goal-1', {
        title: 'MacBook',
        targetAmount: 1200,
        currency: 'EUR',
        targetDate: '2027-02-28',
      })
      expect(listGoals).toHaveBeenCalled()
      expect(goals.value).toEqual([GOAL])
    })

    it('propaga el error sin dejar isLoading colgado', async () => {
      vi.mocked(updateGoal).mockRejectedValue(new Error('meta no activa'))
      const { isLoading, error, update } = useGoals()

      await expect(
        update('goal-1', { title: 'TV', targetAmount: 240, currency: 'USD', targetDate: '2026-11-28' }),
      ).rejects.toThrow('meta no activa')

      expect(error.value).toBe('meta no activa')
      expect(isLoading.value).toBe(false)
    })
  })

  describe('remove', () => {
    it('elimina la meta y refresca lista + resumen', async () => {
      const { remove } = useGoals()

      await remove('goal-1')

      expect(deleteGoal).toHaveBeenCalledWith('goal-1')
      expect(listGoals).toHaveBeenCalled()
      expect(getGoalSummary).toHaveBeenCalled()
    })

    it('propaga el error del servicio', async () => {
      vi.mocked(deleteGoal).mockRejectedValue(new Error('no encontrada'))
      const { error, remove } = useGoals()

      await expect(remove('missing')).rejects.toThrow('no encontrada')
      expect(error.value).toBe('no encontrada')
    })
  })

  describe('checkIn', () => {
    it('registra el aporte y refresca todo', async () => {
      const { checkIn } = useGoals()

      await checkIn('goal-1', { amountSaved: 80 })

      expect(recordCheckIn).toHaveBeenCalledWith('goal-1', { amountSaved: 80 })
      expect(listGoals).toHaveBeenCalled()
      expect(getGoalSummary).toHaveBeenCalled()
      expect(getPendingCheckIns).toHaveBeenCalled()
    })

    it('propaga el error del servicio (ej. meta no activa)', async () => {
      vi.mocked(recordCheckIn).mockRejectedValue(new Error('meta no activa'))
      const { error, checkIn } = useGoals()

      await expect(checkIn('goal-1', { amountSaved: 10 })).rejects.toThrow('meta no activa')
      expect(error.value).toBe('meta no activa')
    })
  })

  describe('abandon', () => {
    it('abandona la meta y refresca todo', async () => {
      const { abandon } = useGoals()

      await abandon('goal-1')

      expect(abandonGoal).toHaveBeenCalledWith('goal-1')
      expect(listGoals).toHaveBeenCalled()
      expect(getGoalSummary).toHaveBeenCalled()
    })

    it('propaga el error del servicio', async () => {
      vi.mocked(abandonGoal).mockRejectedValue(new Error('no se pudo abandonar'))
      const { error, abandon } = useGoals()

      await expect(abandon('goal-1')).rejects.toThrow('no se pudo abandonar')
      expect(error.value).toBe('no se pudo abandonar')
    })
  })
})
