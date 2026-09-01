import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  GoalsApiError,
  createGoal,
  deleteGoal,
  getGoalSummary,
  getPendingCheckIns,
  getSavingsCapacity,
  listGoals,
  previewGoalVoiceEntry,
  recordCheckIn,
  updateGoal,
} from '../goals.service'

function mockResponse(body: unknown, init: { ok?: boolean; status?: number } = {}): Response {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    json: async () => body,
  } as unknown as Response
}

const GOAL_WIRE = {
  id: 'goal-1',
  user_id: 'user-1',
  title: 'TV',
  target_amount: 240,
  currency: 'USD',
  target_date: '2026-11-28',
  total_saved: 80,
  status: 'active',
  created_at: '2026-08-01T00:00:00Z',
  completed_at: null,
  goal_type: 'computer',
  suggested_monthly_contribution: 53.33,
  last_check_in_postponed: false,
}

describe('goals.service', () => {
  beforeEach(() => {
    localStorage.clear()
    localStorage.setItem('berry_auth_token', 'jwt-token')
    setActivePinia(createPinia())
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('createGoal', () => {
    it('manda los campos en snake_case y el token en Authorization', async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse(GOAL_WIRE, { status: 201 }))

      await createGoal({ title: 'TV', targetAmount: 240, currency: 'USD', targetDate: '2026-11-28', goalType: 'custom' })

      const [url, init] = vi.mocked(fetch).mock.calls[0]
      expect(url).toBe('/api/goals')
      expect(init!.method).toBe('POST')
      expect(init!.headers).toEqual({ 'Content-Type': 'application/json', Authorization: 'Bearer jwt-token' })
      expect(JSON.parse(init!.body as string)).toEqual({
        title: 'TV',
        target_amount: 240,
        currency: 'USD',
        target_date: '2026-11-28',
        goal_type: 'custom',
      })
    })

    it('mapea la respuesta snake_case a camelCase, incluyendo los campos calculados', async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse(GOAL_WIRE, { status: 201 }))

      const result = await createGoal({ title: 'TV', targetAmount: 240, currency: 'USD', targetDate: '2026-11-28', goalType: 'computer' })

      expect(result).toEqual({
        id: 'goal-1',
        userId: 'user-1',
        title: 'TV',
        targetAmount: 240,
        currency: 'USD',
        targetDate: '2026-11-28',
        totalSaved: 80,
        status: 'active',
        goalType: 'computer',
        createdAt: '2026-08-01T00:00:00Z',
        completedAt: null,
        suggestedMonthlyContribution: 53.33,
        lastCheckInPostponed: false,
      })
    })

    it('manda initial_amount/initial_amount_note solo cuando vienen', async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse(GOAL_WIRE, { status: 201 }))

      await createGoal({
        title: 'MacBook',
        targetAmount: 1200,
        currency: 'USD',
        targetDate: '2026-11-28',
        goalType: 'computer',
        initialAmount: 700,
        initialAmountNote: 'Si vendo mi laptop u otras pertenencias',
      })

      expect(JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string)).toEqual({
        title: 'MacBook',
        target_amount: 1200,
        currency: 'USD',
        target_date: '2026-11-28',
        goal_type: 'computer',
        initial_amount: 700,
        initial_amount_note: 'Si vendo mi laptop u otras pertenencias',
      })
    })

    it('sin initial_amount, no lo manda en el body', async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse(GOAL_WIRE, { status: 201 }))

      await createGoal({ title: 'TV', targetAmount: 240, currency: 'USD', targetDate: '2026-11-28', goalType: 'custom' })

      const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string)
      expect(body.initial_amount).toBeUndefined()
      expect(body.initial_amount_note).toBeUndefined()
    })

    // Decimal en el backend serializa como STRING en el JSON (ver mismo bug real
    // encontrado y corregido en debts.service.ts) - total_saved arrancaba siempre en
    // "0" antes de esta funcionalidad, asi que nunca se habia notado; con un aporte
    // inicial real, un string sin coercion rompe formatCurrency.ts en USDT
    // (amount.toFixed no existe en un string).
    it('coacciona los montos que llegan como string a number', async () => {
      vi.mocked(fetch).mockResolvedValue(
        mockResponse(
          {
            ...GOAL_WIRE,
            target_amount: '1200',
            total_saved: '700',
            suggested_monthly_contribution: '166.67',
          },
          { status: 201 },
        ),
      )

      const result = await createGoal({
        title: 'MacBook',
        targetAmount: 1200,
        currency: 'USD',
        targetDate: '2026-11-28',
        goalType: 'computer',
        initialAmount: 700,
      })

      expect(result.targetAmount).toBe(1200)
      expect(result.totalSaved).toBe(700)
      expect(result.suggestedMonthlyContribution).toBe(166.67)
    })

    it('lanza GoalsApiError con el status y el detail del backend en error', async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse({ detail: 'Monto inválido.' }, { ok: false, status: 400 }))

      const error: unknown = await createGoal({
        title: 'TV',
        targetAmount: -1,
        currency: 'USD',
        targetDate: '2026-11-28',
        goalType: 'custom',
      }).catch((e: unknown) => e)

      expect(error).toBeInstanceOf(GoalsApiError)
      expect((error as GoalsApiError).status).toBe(400)
      expect((error as GoalsApiError).message).toBe('Monto inválido.')
    })
  })

  describe('updateGoal', () => {
    it('manda PATCH con los 4 campos en snake_case', async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse({ ...GOAL_WIRE, title: 'MacBook', target_amount: 1200 }))

      await updateGoal('goal-1', { title: 'MacBook', targetAmount: 1200, currency: 'EUR', targetDate: '2027-02-28' })

      const [url, init] = vi.mocked(fetch).mock.calls[0]
      expect(url).toBe('/api/goals/goal-1')
      expect(init!.method).toBe('PATCH')
      expect(JSON.parse(init!.body as string)).toEqual({
        title: 'MacBook',
        target_amount: 1200,
        currency: 'EUR',
        target_date: '2027-02-28',
      })
    })

    it('lanza GoalsApiError en 409 (meta no activa)', async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse({ detail: 'Solo se puede editar una meta activa' }, { ok: false, status: 409 }))

      const error: unknown = await updateGoal('goal-1', {
        title: 'TV',
        targetAmount: 240,
        currency: 'USD',
        targetDate: '2026-11-28',
      }).catch((e: unknown) => e)

      expect(error).toBeInstanceOf(GoalsApiError)
      expect((error as GoalsApiError).status).toBe(409)
    })
  })

  describe('getSavingsCapacity', () => {
    it('pide el endpoint y mapea el promedio a camelCase', async () => {
      vi.mocked(fetch).mockResolvedValue(
        mockResponse({ avg_monthly_income: 900, avg_monthly_expense: 600, avg_monthly_available: 300 }),
      )

      const result = await getSavingsCapacity()

      const [url] = vi.mocked(fetch).mock.calls[0]
      expect(url).toBe('/api/goals/savings-capacity')
      expect(result).toEqual({ avgMonthlyIncome: 900, avgMonthlyExpense: 600, avgMonthlyAvailable: 300 })
    })
  })

  describe('listGoals', () => {
    it('sin status, no manda query param', async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse([GOAL_WIRE]))

      await listGoals()

      const [url] = vi.mocked(fetch).mock.calls[0]
      expect(url).toBe('/api/goals')
    })

    it('con status, lo manda como query param', async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse([GOAL_WIRE]))

      await listGoals('completed')

      const [url] = vi.mocked(fetch).mock.calls[0]
      expect(url).toBe('/api/goals?status=completed')
    })
  })

  describe('getGoalSummary', () => {
    it('pide el endpoint de resumen y mapea a camelCase', async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse({ total_saved: 80, total_target: 240 }))

      const result = await getGoalSummary()

      const [url] = vi.mocked(fetch).mock.calls[0]
      expect(url).toBe('/api/goals/summary')
      expect(result).toEqual({ totalSaved: 80, totalTarget: 240 })
    })
  })

  describe('getPendingCheckIns', () => {
    it('mapea la lista de chequeos pendientes a camelCase', async () => {
      vi.mocked(fetch).mockResolvedValue(
        mockResponse([{ goal_id: 'goal-1', title: 'TV', currency: 'USD', target_date: '2026-11-28', suggested_amount: 53.33 }]),
      )

      const result = await getPendingCheckIns()

      expect(result).toEqual([
        { goalId: 'goal-1', title: 'TV', currency: 'USD', targetDate: '2026-11-28', suggestedAmount: 53.33 },
      ])
    })
  })

  describe('recordCheckIn', () => {
    it('manda amount_saved siempre, y new_target_date/note solo si vienen', async () => {
      vi.mocked(fetch).mockResolvedValue(
        mockResponse({
          id: 'ci-1',
          goal_id: 'goal-1',
          period_month: '2026-09-01',
          amount_saved: 80,
          previous_target_date: null,
          new_target_date: null,
          note: null,
          created_at: '2026-09-01T00:00:00Z',
        }),
      )

      await recordCheckIn('goal-1', { amountSaved: 80 })

      const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string)
      expect(body).toEqual({ amount_saved: 80 })
    })

    it('incluye new_target_date y note cuando se postergó', async () => {
      vi.mocked(fetch).mockResolvedValue(
        mockResponse({
          id: 'ci-1',
          goal_id: 'goal-1',
          period_month: '2026-09-01',
          amount_saved: 0,
          previous_target_date: '2026-11-28',
          new_target_date: '2026-12-28',
          note: 'mes dificil',
          created_at: '2026-09-01T00:00:00Z',
        }),
      )

      await recordCheckIn('goal-1', { amountSaved: 0, newTargetDate: '2026-12-28', note: 'mes dificil' })

      const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string)
      expect(body).toEqual({ amount_saved: 0, new_target_date: '2026-12-28', note: 'mes dificil' })
    })

    it('lanza GoalsApiError en 409 (meta no activa)', async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse({ detail: 'Meta no activa.' }, { ok: false, status: 409 }))

      const error: unknown = await recordCheckIn('goal-1', { amountSaved: 10 }).catch((e: unknown) => e)

      expect(error).toBeInstanceOf(GoalsApiError)
      expect((error as GoalsApiError).status).toBe(409)
    })
  })

  describe('deleteGoal', () => {
    it('manda DELETE al endpoint del id con el token', async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse(null, { status: 204 }))

      await deleteGoal('goal-1')

      const [url, init] = vi.mocked(fetch).mock.calls[0]
      expect(url).toBe('/api/goals/goal-1')
      expect(init!.method).toBe('DELETE')
    })
  })

  describe('previewGoalVoiceEntry', () => {
    it('manda el transcript y mapea el preview a camelCase', async () => {
      vi.mocked(fetch).mockResolvedValue(
        mockResponse({
          title: 'MacBook',
          amount: 300,
          amount_is_monthly: true,
          currency: 'USD',
          target_date: '2026-12-28',
        }),
      )

      const result = await previewGoalVoiceEntry('quiero comprar una MacBook en 4 meses, debo reunir 300 al mes')

      const [url, init] = vi.mocked(fetch).mock.calls[0]
      expect(url).toBe('/api/goals/voice-preview')
      expect(JSON.parse(init!.body as string)).toEqual({
        transcript: 'quiero comprar una MacBook en 4 meses, debo reunir 300 al mes',
      })
      expect(result).toEqual({ title: 'MacBook', amount: 300, amountIsMonthly: true, currency: 'USD', targetDate: '2026-12-28' })
    })
  })
})
