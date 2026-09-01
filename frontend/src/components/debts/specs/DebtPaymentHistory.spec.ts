import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { useWalletsStore } from '../../../stores/wallets.store'
import type { DebtPayment } from '../../../services/debts/interfaces/debts.interface'
import DebtPaymentHistory from '../DebtPaymentHistory.vue'

function makePayment(overrides: Partial<DebtPayment> = {}): DebtPayment {
  return {
    id: 'payment-1',
    debtId: 'debt-1',
    amount: 50,
    currency: 'USD',
    appliedAmount: 50,
    note: null,
    paidAt: '2026-08-30',
    walletId: null,
    createdAt: '2026-08-30T00:00:00Z',
    ...overrides,
  }
}

describe('DebtPaymentHistory', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('muestra el monto de cada pago', () => {
    const wrapper = mount(DebtPaymentHistory, { props: { payments: [makePayment()], debtCurrency: 'USD' } })

    expect(wrapper.text()).toContain('50')
  })

  it('sin diferencia de moneda, no muestra el equivalente aplicado', () => {
    const wrapper = mount(DebtPaymentHistory, { props: { payments: [makePayment()], debtCurrency: 'USD' } })

    expect(wrapper.find('.payment-applied').exists()).toBe(false)
  })

  it('con moneda distinta a la de la deuda, muestra el equivalente aplicado', () => {
    const payment = makePayment({ currency: 'USDT', amount: 50, appliedAmount: 49.5 })
    const wrapper = mount(DebtPaymentHistory, { props: { payments: [payment], debtCurrency: 'USD' } })

    expect(wrapper.find('.payment-applied').exists()).toBe(true)
    expect(wrapper.find('.payment-applied').text()).toContain('49.5')
  })

  it('muestra la nota cuando existe', () => {
    const payment = makePayment({ note: 'Transferencia por Zelle' })
    const wrapper = mount(DebtPaymentHistory, { props: { payments: [payment], debtCurrency: 'USD' } })

    expect(wrapper.text()).toContain('Transferencia por Zelle')
  })

  it('muestra el nombre de la billetera cuando el pago esta vinculado a una', () => {
    const walletsStore = useWalletsStore()
    walletsStore.wallets.push({ id: 'wallet-1', name: 'Binance', currency: 'USDT', balance: 100, createdAt: '2026-08-01T00:00:00Z' })
    const payment = makePayment({ walletId: 'wallet-1' })

    const wrapper = mount(DebtPaymentHistory, { props: { payments: [payment], debtCurrency: 'USD' } })

    expect(wrapper.text()).toContain('Binance')
  })

  it('no emite "remove" con un solo click - pide confirmacion primero', async () => {
    const wrapper = mount(DebtPaymentHistory, { props: { payments: [makePayment({ id: 'payment-9' })], debtCurrency: 'USD' } })

    await wrapper.find('.payment-remove-trigger').trigger('click')

    expect(wrapper.emitted('remove')).toBeFalsy()
    expect(wrapper.find('.payment-confirm-text').text()).toBe('¿Eliminar pago?')
  })

  it('emite "remove" con el id del pago solo despues de confirmar', async () => {
    const wrapper = mount(DebtPaymentHistory, { props: { payments: [makePayment({ id: 'payment-9' })], debtCurrency: 'USD' } })

    await wrapper.find('.payment-remove-trigger').trigger('click')
    await wrapper.find('.payment-confirm-delete').trigger('click')

    expect(wrapper.emitted('remove')).toEqual([['payment-9']])
  })

  it('cancelar vuelve al trigger sin emitir "remove"', async () => {
    const wrapper = mount(DebtPaymentHistory, { props: { payments: [makePayment({ id: 'payment-9' })], debtCurrency: 'USD' } })

    await wrapper.find('.payment-remove-trigger').trigger('click')
    await wrapper.find('.payment-confirm-cancel').trigger('click')

    expect(wrapper.find('.payment-remove-trigger').exists()).toBe(true)
    expect(wrapper.emitted('remove')).toBeFalsy()
  })

  it('usa el icono de ingreso cuando la deuda es "owed_to_user" (le pagan al usuario)', () => {
    const wrapper = mount(DebtPaymentHistory, {
      props: { payments: [makePayment()], debtCurrency: 'USD', direction: 'owed_to_user' },
    })

    expect(wrapper.find('.icon-badge.income').exists()).toBe(true)
  })

  it('usa el icono de gasto cuando la deuda es "owed_by_user" (el usuario paga)', () => {
    const wrapper = mount(DebtPaymentHistory, {
      props: { payments: [makePayment()], debtCurrency: 'USD', direction: 'owed_by_user' },
    })

    expect(wrapper.find('.icon-badge.expense').exists()).toBe(true)
  })
})
