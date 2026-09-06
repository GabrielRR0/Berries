import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useOnlineStatus } from '../../../composables/connectivity/useOnlineStatus'
import * as goalsService from '../../../services/goals/goals.service'
import * as walletsService from '../../../services/wallets/wallets.service'
import type { Goal } from '../../../services/goals/interfaces/goals.interface'
import { useOfflineQueueStore } from '../../../stores/offlineQueue.store'
import GoalCard from '../GoalCard.vue'
import GoalsMain from '../GoalsMain.vue'

vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }) }))

const GOAL: Goal = {
  id: 'goal-1',
  userId: 'user-1',
  title: 'Viaje',
  targetAmount: 100000,
  currency: 'CLP',
  targetDate: '2026-12-01',
  totalSaved: 0,
  status: 'active',
  goalType: 'travel',
  createdAt: '2026-01-01T00:00:00.000Z',
  completedAt: null,
  suggestedMonthlyContribution: 10000,
  lastCheckInPostponed: false,
}

function mountGoalsMain() {
  return mount(GoalsMain)
}

async function flushPromises() {
  await new Promise((resolve) => setTimeout(resolve, 0))
  await Promise.resolve()
}

describe('GoalsMain - agregar aporte en modo offline', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
    vi.spyOn(goalsService, 'listGoals').mockResolvedValue([GOAL])
    vi.spyOn(goalsService, 'getGoalSummary').mockResolvedValue({ totalSaved: 0, totalTarget: 100000 })
    vi.spyOn(goalsService, 'getPendingCheckIns').mockResolvedValue([])
    vi.spyOn(goalsService, 'getSavingsCapacity').mockResolvedValue({ monthlyCapacity: 0, alreadyCommitted: 0 } as never)
    vi.spyOn(goalsService, 'getWalletCommitments').mockResolvedValue([])
    vi.spyOn(goalsService, 'recordCheckIn').mockReset()
    vi.spyOn(walletsService, 'listWallets').mockResolvedValue([])
    useOnlineStatus().isOnline.value = true
  })

  it('online: registra el aporte llamando al service, sin encolar nada', async () => {
    vi.mocked(goalsService.recordCheckIn).mockResolvedValue({
      id: 'ci1',
      goalId: 'goal-1',
      periodMonth: '2026-01',
      amountSaved: 5000,
      note: null,
      walletId: null,
      createdAt: '2026-01-01T00:00:00.000Z',
    } as never)
    const wrapper = mountGoalsMain()
    await flushPromises()

    await wrapper.findComponent(GoalCard).vm.$emit('addContribution', { amountSaved: 5000 })
    await flushPromises()

    expect(goalsService.recordCheckIn).toHaveBeenCalledWith('goal-1', { amountSaved: 5000 })
    expect(useOfflineQueueStore().items).toHaveLength(0)
  })

  it('offline: encola el aporte en vez de llamar al service, con el snapshot de la meta', async () => {
    useOnlineStatus().isOnline.value = false
    const wrapper = mountGoalsMain()
    await flushPromises()

    await wrapper.findComponent(GoalCard).vm.$emit('addContribution', { amountSaved: 7000 })
    await flushPromises()

    expect(goalsService.recordCheckIn).not.toHaveBeenCalled()
    const offlineQueue = useOfflineQueueStore()
    expect(offlineQueue.items).toHaveLength(1)
    expect(offlineQueue.items[0]).toMatchObject({
      kind: 'goalContribution',
      goalId: 'goal-1',
      snapshot: { goalTitle: 'Viaje', goalCurrency: 'CLP', amountSaved: 7000 },
    })
  })
})
