import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import type { SavingsCapacity } from '../../../services/goals/interfaces/goals.interface'
import CreateGoalWizard from '../CreateGoalWizard.vue'

// Secuencial, NO Promise.all de triggers sin await: el prop modelValue que
// AmountKeypad recibe del padre se actualiza recien en el siguiente render de Vue
// (no de forma sincronica), asi que disparar varios clicks sin esperar cada uno
// hace que cada digito lea un modelValue todavia viejo (se pisan entre si).
async function typeAmount(wrapper: ReturnType<typeof mount>, digits: string) {
  for (const digit of digits) {
    await wrapper.findAll('.amount-keypad .key').find((key) => key.text() === digit)!.trigger('click')
  }
}

describe('CreateGoalWizard', () => {
  it('arranca en el paso 1, mostrando el grid de plantillas', () => {
    const wrapper = mount(CreateGoalWizard)

    expect(wrapper.text()).toContain('¿Cuál es tu objetivo?')
    expect(wrapper.findAll('.type-tile').length).toBe(8) // 7 plantillas + Personalizada
  })

  it('elegir una plantilla avanza al paso 2 y precarga el titulo', async () => {
    const wrapper = mount(CreateGoalWizard)

    await wrapper.findAll('.type-tile').find((tile) => tile.text().includes('Comprar un computador'))!.trigger('click')

    expect(wrapper.find('.wizard-title-input').exists()).toBe(true)
    expect((wrapper.find('.wizard-title-input').element as HTMLInputElement).value).toBe('Comprar un computador')
  })

  it('"Personalizada" avanza al paso 2 sin precargar titulo', async () => {
    const wrapper = mount(CreateGoalWizard)

    await wrapper.find('.type-tile-custom').trigger('click')

    expect((wrapper.find('.wizard-title-input').element as HTMLInputElement).value).toBe('')
  })

  it('el boton de atras en el paso 2 vuelve al paso 1', async () => {
    const wrapper = mount(CreateGoalWizard)
    await wrapper.find('.type-tile-custom').trigger('click')

    await wrapper.find('.wizard-back').trigger('click')

    expect(wrapper.text()).toContain('¿Cuál es tu objetivo?')
  })

  it('el paso 1 no tiene boton de atras (cerrar el wizard es cosa del BottomSheet que lo contiene)', async () => {
    const wrapper = mount(CreateGoalWizard)

    expect(wrapper.find('.wizard-back').exists()).toBe(false)
  })

  it('escribir con el teclado numerico actualiza el monto mostrado', async () => {
    const wrapper = mount(CreateGoalWizard)
    await wrapper.find('.type-tile-custom').trigger('click')

    await typeAmount(wrapper, '240')

    expect(wrapper.find('.wizard-amount-display').text()).toContain('240')
  })

  it('"Continuar" queda deshabilitado hasta completar titulo, fecha y monto', async () => {
    const wrapper = mount(CreateGoalWizard)
    await wrapper.find('.type-tile-custom').trigger('click')

    expect((wrapper.find('.wizard-next').element as HTMLButtonElement).disabled).toBe(true)

    await wrapper.find('.wizard-title-input').setValue('MacBook')
    await wrapper.find('input[type="date"]').setValue('2026-12-28')
    await typeAmount(wrapper, '1200')

    expect((wrapper.find('.wizard-next').element as HTMLButtonElement).disabled).toBe(false)
  })

  it('"Continuar" avanza al resumen con los datos correctos', async () => {
    const wrapper = mount(CreateGoalWizard)
    await wrapper.find('.type-tile-custom').trigger('click')
    await wrapper.find('.wizard-title-input').setValue('MacBook')
    await wrapper.find('input[type="date"]').setValue('2026-12-28')
    await typeAmount(wrapper, '1200')

    await wrapper.find('.wizard-next').trigger('click')

    expect(wrapper.text()).toContain('Resumen de tu meta')
    expect(wrapper.text()).toContain('MacBook')
    expect(wrapper.text()).toContain('$1,200.00')
  })

  it('"Crear meta" emite "create" con el goalType elegido', async () => {
    const wrapper = mount(CreateGoalWizard)
    await wrapper.findAll('.type-tile').find((tile) => tile.text().includes('Comprar un computador'))!.trigger('click')
    await wrapper.find('input[type="date"]').setValue('2026-12-28')
    await typeAmount(wrapper, '1200')
    await wrapper.find('.wizard-next').trigger('click')

    await wrapper.find('.wizard-next').trigger('click') // "Crear meta" reusa la misma clase en el paso 3

    expect(wrapper.emitted('create')).toEqual([
      [{ title: 'Comprar un computador', targetAmount: 1200, currency: 'USD', targetDate: '2026-12-28', goalType: 'computer' }],
    ])
  })

  it('modo "Aporte mensual" calcula el total segun los meses restantes', async () => {
    const wrapper = mount(CreateGoalWizard)
    await wrapper.find('.type-tile-custom').trigger('click')
    await wrapper.find('.wizard-title-input').setValue('TV')
    await wrapper.find('input[type="date"]').setValue('2026-12-28')

    await wrapper.findAll('.amount-mode-option').find((btn) => btn.text() === 'Aporte mensual')!.trigger('click')
    await typeAmount(wrapper, '80')

    expect(wrapper.find('.wizard-hint').exists()).toBe(true)
    expect(wrapper.find('.wizard-hint').text()).toContain('Total estimado')
  })

  it('con datos de voz, salta directo al paso 2 prellenado', () => {
    const wrapper = mount(CreateGoalWizard, {
      props: {
        initialTitle: 'MacBook',
        initialAmount: 1200,
        initialAmountIsMonthly: false,
        initialCurrency: 'USD',
        initialTargetDate: '2026-12-28',
      },
    })

    expect(wrapper.find('.wizard-title-input').exists()).toBe(true)
    expect((wrapper.find('.wizard-title-input').element as HTMLInputElement).value).toBe('MacBook')
  })

  it('avisa cuando el aporte implicito supera el disponible promedio', async () => {
    const capacity: SavingsCapacity = { avgMonthlyIncome: 500, avgMonthlyExpense: 480, avgMonthlyAvailable: 20 }
    const wrapper = mount(CreateGoalWizard, { props: { savingsCapacity: capacity } })
    await wrapper.find('.type-tile-custom').trigger('click')
    await wrapper.find('input[type="date"]').setValue('2026-09-28')

    await typeAmount(wrapper, '1000')

    const hint = wrapper.find('.capacity-hint')
    expect(hint.exists()).toBe(true)
    expect(hint.classes()).toContain('warning')
  })
})
