import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import type { Goal, SavingsCapacity } from '../../../services/goals/interfaces/goals.interface'
import { monthsBetween } from '../../../utils/goals/monthsBetween'
import EditGoalForm from '../EditGoalForm.vue'

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

describe('EditGoalForm', () => {
  it('arranca prellenado con los datos de la meta', () => {
    const wrapper = mount(EditGoalForm, { props: { goal: GOAL } })

    expect((wrapper.find('input[type="text"]').element as HTMLInputElement).value).toBe('TV')
    expect((wrapper.find('input[type="date"]').element as HTMLInputElement).value).toBe('2026-11-28')
    expect((wrapper.find('.amount-input').element as HTMLInputElement).value).toBe('240')
  })

  it('emite "submit" con los datos editados', async () => {
    const wrapper = mount(EditGoalForm, { props: { goal: GOAL } })

    await wrapper.find('.amount-input').setValue('300')
    await wrapper.find('form').trigger('submit')

    expect(wrapper.emitted('submit')).toEqual([
      [{ title: 'TV', targetAmount: 300, currency: 'USD', targetDate: '2026-11-28' }],
    ])
  })

  it('calcula el total a partir del aporte mensual cuando se usa ese modo', async () => {
    const wrapper = mount(EditGoalForm, { props: { goal: GOAL } })

    await wrapper.findAll('.amount-mode-option')[1]!.trigger('click')
    await wrapper.find('.amount-input').setValue('80')
    await wrapper.find('form').trigger('submit')

    const emitted = wrapper.emitted('submit')
    expect(emitted).toBeTruthy()
    const [input] = emitted![0] as [{ targetAmount: number }]
    expect(input.targetAmount).toBeGreaterThan(0)
  })

  // Bug real reportado por el usuario editando una meta real: en modo "Monto total"
  // no se mostraba ningun texto explicativo (a diferencia de CreateGoalWizard.vue).
  it('modo "Monto total" explica cuantos meses quedan, el promedio, y lo ya ahorrado', () => {
    const wrapper = mount(EditGoalForm, { props: { goal: GOAL } })

    const months = monthsBetween(new Date(), new Date(GOAL.targetDate))
    const remaining = GOAL.targetAmount - GOAL.totalSaved
    const expectedAverage = (remaining / months).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

    const hint = wrapper.find('.field-hint').text()
    expect(hint).toContain('Te faltan')
    expect(hint).toContain(`$${expectedAverage} al mes`)
    expect(hint).toContain('sumando los $80.00 que ya tienes ahorrados')
    expect(hint).toContain('completarías tu meta a tiempo')
  })

  it('modo "Monto total" cuando lo ahorrado ya cubre el nuevo objetivo, avisa que no falta nada', async () => {
    const wrapper = mount(EditGoalForm, { props: { goal: GOAL } })

    await wrapper.find('.amount-input').setValue('50')

    const hint = wrapper.find('.field-hint').text()
    expect(hint).toContain('cubre por completo tu meta')
    expect(hint).toContain('No necesitas ahorrar nada más')
  })

  it('emite "cancel" al hacer click en Cancelar', async () => {
    const wrapper = mount(EditGoalForm, { props: { goal: GOAL } })

    await wrapper.find('.form-actions button[type="button"]').trigger('click')

    expect(wrapper.emitted('cancel')).toBeTruthy()
  })

  it('muestra el boton "Guardar cambios"', () => {
    const wrapper = mount(EditGoalForm, { props: { goal: GOAL } })

    expect(wrapper.find('button[type="submit"]').text()).toBe('Guardar cambios')
  })

  it('avisa cuando el aporte implicito supera el disponible promedio', async () => {
    const capacity: SavingsCapacity = { avgMonthlyIncome: 500, avgMonthlyExpense: 480, avgMonthlyAvailable: 20, hasEnoughHistory: true }
    const wrapper = mount(EditGoalForm, { props: { goal: GOAL, savingsCapacity: capacity } })

    await wrapper.find('.amount-input').setValue('10000')

    const hint = wrapper.find('.capacity-hint')
    expect(hint.exists()).toBe(true)
    expect(hint.classes()).toContain('warning')
  })

  // Pedido explicito del usuario: una cuenta nueva (el mes en curso todavia no
  // termino) no tiene un "promedio" real todavia - no avisar nada con eso.
  it('no avisa si la cuenta no tiene suficiente historial', async () => {
    const capacity: SavingsCapacity = { avgMonthlyIncome: 0, avgMonthlyExpense: 5510.01, avgMonthlyAvailable: -5510.01, hasEnoughHistory: false }
    const wrapper = mount(EditGoalForm, { props: { goal: GOAL, savingsCapacity: capacity } })

    await wrapper.find('.amount-input').setValue('10000')

    expect(wrapper.find('.capacity-hint').exists()).toBe(false)
  })
})
