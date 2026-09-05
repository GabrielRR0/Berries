import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createGoal,
  getSavingsCapacity,
  getWalletCommitments,
} from '../../../services/goals/goals.service'
import * as walletsService from '../../../services/wallets/wallets.service'
import CreateGoalView from '../CreateGoalView.vue'

vi.mock('../../../services/goals/goals.service', () => ({
  listGoals: vi.fn(),
  getGoalSummary: vi.fn(),
  getPendingCheckIns: vi.fn(),
  getSavingsCapacity: vi.fn(),
  getWalletCommitments: vi.fn(),
  createGoal: vi.fn(),
  updateGoal: vi.fn(),
  deleteGoal: vi.fn(),
  recordCheckIn: vi.fn(),
  abandonGoal: vi.fn(),
  getGoal: vi.fn(),
}))

vi.mock('../../../services/categories/categories.service', () => ({
  listCategories: vi.fn().mockResolvedValue([]),
  createCategory: vi.fn(),
  deleteCategory: vi.fn(),
  hideCategory: vi.fn(),
  unhideCategory: vi.fn(),
}))

const push = vi.fn()
vi.mock('vue-router', () => ({
  useRouter: () => ({ push }),
}))

describe('CreateGoalView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    push.mockReset()
    vi.mocked(getSavingsCapacity)
      .mockReset()
      .mockResolvedValue({ avgMonthlyIncome: 0, avgMonthlyExpense: 0, avgMonthlyAvailable: 0, hasEnoughHistory: false })
    vi.mocked(createGoal).mockReset()
    vi.mocked(getWalletCommitments).mockReset().mockResolvedValue([])
    vi.spyOn(walletsService, 'listWallets').mockResolvedValue([])
  })

  it('pide el promedio de ingresos/gastos al montar', async () => {
    mount(CreateGoalView)
    await flushPromises()

    expect(getSavingsCapacity).toHaveBeenCalled()
  })

  it('muestra el titulo "Nueva meta" y el wizard', () => {
    const wrapper = mount(CreateGoalView)

    expect(wrapper.text()).toContain('Nueva meta')
    expect(wrapper.text()).toContain('¿Cuál es tu objetivo?')
  })

  it('crear la meta navega de vuelta a la lista de metas', async () => {
    vi.mocked(createGoal).mockResolvedValue({
      id: 'goal-1',
      userId: 'user-1',
      title: 'MacBook',
      targetAmount: 1200,
      currency: 'USD',
      targetDate: '2026-12-28',
      totalSaved: 0,
      status: 'active',
      goalType: 'custom',
      createdAt: '2026-08-01T00:00:00Z',
      completedAt: null,
      suggestedMonthlyContribution: 100,
      lastCheckInPostponed: false,
    })
    const wrapper = mount(CreateGoalView)

    await wrapper.find('.type-tile-custom').trigger('click')
    await wrapper.find('.wizard-title-input').setValue('MacBook')
    await wrapper.find('input[type="date"]').setValue('2026-12-28')
    await wrapper.find('.wizard-amount-input').setValue('1200')
    await wrapper.find('.wizard-next').trigger('click')
    await wrapper.find('.wizard-next').trigger('click') // "Crear meta"
    await flushPromises()

    expect(createGoal).toHaveBeenCalled()
    expect(push).toHaveBeenCalledWith({ name: 'metas' })
  })

  it('el boton "Volver" del header navega a la lista de metas', async () => {
    const wrapper = mount(CreateGoalView)

    await wrapper.find('[aria-label="Volver"]').trigger('click')

    expect(push).toHaveBeenCalledWith({ name: 'metas' })
  })
})
