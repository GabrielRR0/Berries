import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getGoal, getSavingsCapacity, updateGoal } from '../../../services/goals/goals.service'
import type { Goal } from '../../../services/goals/interfaces/goals.interface'
import EditGoalView from '../EditGoalView.vue'

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
  getGoal: vi.fn(),
}))

const push = vi.fn()
vi.mock('vue-router', () => ({
  useRouter: () => ({ push }),
  useRoute: () => ({ params: { id: 'goal-1' } }),
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

describe('EditGoalView', () => {
  beforeEach(() => {
    push.mockReset()
    vi.mocked(getGoal).mockReset()
    vi.mocked(getSavingsCapacity)
      .mockReset()
      .mockResolvedValue({ avgMonthlyIncome: 0, avgMonthlyExpense: 0, avgMonthlyAvailable: 0, hasEnoughHistory: false })
    vi.mocked(updateGoal).mockReset()
  })

  it('muestra un estado de carga mientras pide la meta', () => {
    vi.mocked(getGoal).mockReturnValue(new Promise(() => {})) // nunca resuelve, para inspeccionar el estado intermedio
    const wrapper = mount(EditGoalView)

    expect(wrapper.text()).toContain('Cargando meta')
  })

  it('pide la meta por id de la ruta y precarga el formulario', async () => {
    vi.mocked(getGoal).mockResolvedValue(GOAL)
    const wrapper = mount(EditGoalView)
    await flushPromises()

    expect(getGoal).toHaveBeenCalledWith('goal-1')
    expect((wrapper.find('input[type="text"]').element as HTMLInputElement).value).toBe('TV')
  })

  it('si la meta no existe, muestra el mensaje de error', async () => {
    vi.mocked(getGoal).mockRejectedValue(new Error('Meta no encontrada'))
    const wrapper = mount(EditGoalView)
    await flushPromises()

    expect(wrapper.text()).toContain('Meta no encontrada')
  })

  it('guardar los cambios navega de vuelta a la lista de metas', async () => {
    vi.mocked(getGoal).mockResolvedValue(GOAL)
    vi.mocked(updateGoal).mockResolvedValue(GOAL)
    const wrapper = mount(EditGoalView)
    await flushPromises()

    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(updateGoal).toHaveBeenCalledWith('goal-1', expect.objectContaining({ title: 'TV' }))
    expect(push).toHaveBeenCalledWith({ name: 'metas' })
  })

  it('el boton "Volver" del header navega a la lista de metas', async () => {
    vi.mocked(getGoal).mockResolvedValue(GOAL)
    const wrapper = mount(EditGoalView)
    await flushPromises()

    await wrapper.find('[aria-label="Volver"]').trigger('click')

    expect(push).toHaveBeenCalledWith({ name: 'metas' })
  })
})
