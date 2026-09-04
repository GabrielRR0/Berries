import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import CreateDebtForm from '../CreateDebtForm.vue'

// Ideas de la sesion de brainstorm de UI: (1) el campo de moneda era texto
// libre en vez del <select> compartido (SUPPORTED_CURRENCIES) que usa el
// resto de la app - el backend igual rechaza cualquier codigo fuera de esas
// 6 monedas, asi que el texto libre solo invitaba a un error confuso.
// (2) el monto no agrupaba miles como ya hace el wizard de Metas.
describe('CreateDebtForm', () => {
  // El primer <select> del form es "Direccion" (Me deben/Yo debo) - el de
  // moneda es el segundo, dentro del field-row de Monto/Moneda.
  function currencySelect(wrapper: ReturnType<typeof mount>) {
    return wrapper.findAll('select')[1]!
  }

  it('arranca con USD seleccionado en el select de moneda', () => {
    const wrapper = mount(CreateDebtForm)

    expect((currencySelect(wrapper).element as HTMLSelectElement).value).toBe('USD')
  })

  it('el select de moneda ofrece las 6 monedas soportadas por la app', () => {
    const wrapper = mount(CreateDebtForm)

    const options = currencySelect(wrapper)
      .findAll('option')
      .map((o) => o.element.value)
    expect(options).toEqual(['USD', 'EUR', 'VEF', 'USDT', 'COP', 'ARS'])
  })

  it('agrupa miles en vivo mientras se escribe el monto', async () => {
    const wrapper = mount(CreateDebtForm)

    await wrapper.find('input[type="text"][inputmode="decimal"]').setValue('1300')

    expect((wrapper.find('input[type="text"][inputmode="decimal"]').element as HTMLInputElement).value).toBe('1,300')
  })

  it('emite "create" con el monto sin comas y la moneda elegida', async () => {
    const wrapper = mount(CreateDebtForm)

    await wrapper.find('input[type="text"][inputmode="decimal"]').setValue('1300')
    await wrapper.find('input[placeholder="Ej. Juan Pérez"]').setValue('Ana')
    await currencySelect(wrapper).setValue('EUR')
    await wrapper.find('form').trigger('submit.prevent')

    expect(wrapper.emitted('create')![0]).toEqual([
      { counterpartyName: 'Ana', direction: 'owed_to_user', totalAmount: 1300, currency: 'EUR' },
    ])
  })
})
