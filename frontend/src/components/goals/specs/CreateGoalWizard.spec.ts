import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import type { SavingsCapacity } from '../../../services/goals/interfaces/goals.interface'
import { monthsBetween } from '../../../utils/goals/monthsBetween'
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

  // "Ya tienes algo ahorrado" - pedido explicito del usuario: un headstart opcional
  // hacia la meta ("tengo $700 si vendo mi laptop"), con un detalle libre de donde
  // sale la plata.
  it('el bloque "ya tienes ahorrado" arranca colapsado, sin campos visibles', async () => {
    const wrapper = mount(CreateGoalWizard)
    await wrapper.find('.type-tile-custom').trigger('click')

    expect(wrapper.find('.initial-savings-toggle').exists()).toBe(true)
    expect(wrapper.find('.initial-savings-fields').exists()).toBe(false)
  })

  it('tocar el toggle revela el monto y el detalle, "Quitar" los vuelve a colapsar', async () => {
    const wrapper = mount(CreateGoalWizard)
    await wrapper.find('.type-tile-custom').trigger('click')

    await wrapper.find('.initial-savings-toggle').trigger('click')
    expect(wrapper.find('.initial-savings-fields').exists()).toBe(true)

    await wrapper.find('.initial-savings-remove').trigger('click')
    expect(wrapper.find('.initial-savings-fields').exists()).toBe(false)
    expect(wrapper.find('.initial-savings-toggle').exists()).toBe(true)
  })

  it('"Crear meta" incluye initialAmount/initialAmountNote cuando se completan', async () => {
    const wrapper = mount(CreateGoalWizard)
    await wrapper.findAll('.type-tile').find((tile) => tile.text().includes('Comprar un computador'))!.trigger('click')
    await wrapper.find('input[type="date"]').setValue('2026-12-28')
    await typeAmount(wrapper, '1200')
    await wrapper.find('.initial-savings-toggle').trigger('click')
    await wrapper.find('.initial-savings-fields input[type="number"]').setValue('700')
    await wrapper.find('.initial-savings-note').setValue('Si vendo mi laptop u otras pertenencias')
    await wrapper.find('.wizard-next').trigger('click')

    await wrapper.find('.wizard-next').trigger('click')

    expect(wrapper.emitted('create')).toEqual([
      [
        {
          title: 'Comprar un computador',
          targetAmount: 1200,
          currency: 'USD',
          targetDate: '2026-12-28',
          goalType: 'computer',
          initialAmount: 700,
          initialAmountNote: 'Si vendo mi laptop u otras pertenencias',
        },
      ],
    ])
  })

  it('sin nada ahorrado, "Crear meta" no manda initialAmount/initialAmountNote', async () => {
    const wrapper = mount(CreateGoalWizard)
    await wrapper.find('.type-tile-custom').trigger('click')
    await wrapper.find('.wizard-title-input').setValue('TV')
    await wrapper.find('input[type="date"]').setValue('2026-12-28')
    await typeAmount(wrapper, '240')
    await wrapper.find('.wizard-next').trigger('click')

    await wrapper.find('.wizard-next').trigger('click')

    const [payload] = wrapper.emitted('create')![0] as [Record<string, unknown>]
    expect(payload.initialAmount).toBeUndefined()
    expect(payload.initialAmountNote).toBeUndefined()
  })

  it('el resumen muestra cuanto ya tiene ahorrado y su detalle', async () => {
    const wrapper = mount(CreateGoalWizard)
    await wrapper.find('.type-tile-custom').trigger('click')
    await wrapper.find('.wizard-title-input').setValue('MacBook')
    await wrapper.find('input[type="date"]').setValue('2026-12-28')
    await typeAmount(wrapper, '1200')
    await wrapper.find('.initial-savings-toggle').trigger('click')
    await wrapper.find('.initial-savings-fields input[type="number"]').setValue('700')
    await wrapper.find('.initial-savings-note').setValue('Si vendo mi laptop u otras pertenencias')

    await wrapper.find('.wizard-next').trigger('click')

    expect(wrapper.text()).toContain('Ya tienes ahorrado')
    expect(wrapper.text()).toContain('$700.00')
    expect(wrapper.text()).toContain('Si vendo mi laptop u otras pertenencias')
  })

  it('el ahorro ya reunido descuenta del aporte mensual sugerido (monto total)', async () => {
    const wrapper = mount(CreateGoalWizard)
    await wrapper.find('.type-tile-custom').trigger('click')
    await wrapper.find('.wizard-title-input').setValue('MacBook')
    await wrapper.find('input[type="date"]').setValue('2026-12-28')
    await typeAmount(wrapper, '1200')
    await wrapper.find('.initial-savings-toggle').trigger('click')
    await wrapper.find('.initial-savings-fields input[type="number"]').setValue('1200')

    await wrapper.find('.wizard-next').trigger('click')

    // Objetivo ya cubierto del todo por lo ahorrado -> nada que sugerir por mes.
    expect(wrapper.text()).toContain('Ahorro mensual')
    expect(wrapper.text()).toContain('$0.00 / mes')
  })

  it('modo "Aporte mensual" suma lo ya ahorrado al total estimado', async () => {
    const wrapper = mount(CreateGoalWizard)
    await wrapper.find('.type-tile-custom').trigger('click')
    await wrapper.find('.wizard-title-input').setValue('TV')
    await wrapper.find('input[type="date"]').setValue('2026-12-28')
    await wrapper.find('.initial-savings-toggle').trigger('click')
    await wrapper.find('.initial-savings-fields input[type="number"]').setValue('700')

    await wrapper.findAll('.amount-mode-option').find((btn) => btn.text() === 'Aporte mensual')!.trigger('click')
    await typeAmount(wrapper, '80')

    const months = monthsBetween(new Date(), new Date('2026-12-28'))
    const expectedTotal = (80 * months + 700).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    expect(wrapper.find('.wizard-hint').text()).toContain(`Total estimado: $${expectedTotal}`)
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
