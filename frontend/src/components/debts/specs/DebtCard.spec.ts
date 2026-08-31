import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import DebtCard from '../DebtCard.vue'

const DEBT = {
  id: 'debt-1',
  userId: 'user-1',
  counterpartyName: 'Juan Pérez',
  direction: 'owed_to_user' as const,
  totalAmount: 50,
  currency: 'USD',
  description: null,
  createdAt: '2026-08-01T00:00:00Z',
  installments: [],
}

describe('DebtCard', () => {
  it('muestra la contraparte y la etiqueta de direccion', () => {
    const wrapper = mount(DebtCard, { props: { debt: DEBT } })

    expect(wrapper.text()).toContain('Juan Pérez')
    expect(wrapper.text()).toContain('Te deben')
  })

  // Bug real corregido: antes el "×" del header borraba la deuda de una,
  // sin confirmar - pedido explicito del usuario de cuidar animaciones/UX
  // en Deudas, mismo criterio de dos pasos que WalletCard.vue.
  it('no emite "remove" con un solo click - pide confirmacion primero', async () => {
    const wrapper = mount(DebtCard, { props: { debt: DEBT } })

    await wrapper.find('.debt-delete-trigger').trigger('click')

    expect(wrapper.emitted('remove')).toBeFalsy()
    expect(wrapper.find('.debt-confirm-text').text()).toBe('¿Eliminar deuda?')
  })

  it('emite "remove" solo despues de confirmar', async () => {
    const wrapper = mount(DebtCard, { props: { debt: DEBT } })

    await wrapper.find('.debt-delete-trigger').trigger('click')
    await wrapper.find('.debt-confirm-delete').trigger('click')

    expect(wrapper.emitted('remove')).toBeTruthy()
  })

  it('cancelar vuelve al trigger sin emitir "remove"', async () => {
    const wrapper = mount(DebtCard, { props: { debt: DEBT } })

    await wrapper.find('.debt-delete-trigger').trigger('click')
    await wrapper.find('.debt-confirm-cancel').trigger('click')

    expect(wrapper.find('.debt-delete-trigger').exists()).toBe(true)
    expect(wrapper.emitted('remove')).toBeFalsy()
  })
})
