import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { useWalletsStore } from '../../../stores/wallets.store'
import type { Debt } from '../../../services/debts/interfaces/debts.interface'
import AddDebtPaymentForm from '../AddDebtPaymentForm.vue'

const DEBT: Debt = {
  id: 'debt-1',
  userId: 'user-1',
  counterpartyName: 'Steven',
  direction: 'owed_to_user',
  totalAmount: 500,
  currency: 'USD',
  description: null,
  createdAt: '2026-08-01T00:00:00Z',
  installments: [],
  payments: [],
  amountPaid: 0,
  remainingAmount: 500,
}

function mountForm(debt: Debt = DEBT) {
  return mount(AddDebtPaymentForm, {
    props: { debt },
    global: {
      stubs: {
        DebtPaymentVoiceButton: {
          template: '<button class="voice-stub" type="button" @click="$emit(\'parsed\', preview)"></button>',
          data: () => ({
            preview: { amount: 50, currency: 'USDT', paidAt: '2026-08-25', note: 'ayer me pagaron 50 usdt' },
          }),
        },
      },
    },
  })
}

describe('AddDebtPaymentForm', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('arranca con la moneda de la deuda y sin pedir el equivalente aplicado', () => {
    const wrapper = mountForm()

    expect((wrapper.find('select').element as HTMLSelectElement).value).toBe('USD')
    expect(wrapper.text()).not.toContain('Equivalente aplicado')
  })

  it('el boton de enviar esta deshabilitado sin un monto', () => {
    const wrapper = mountForm()

    expect(wrapper.find('button[type="submit"]').attributes('disabled')).toBeDefined()
  })

  it('con monto en la misma moneda que la deuda, se puede enviar sin el equivalente aplicado', async () => {
    const wrapper = mountForm()

    await wrapper.find('input[type="number"]').setValue('50')

    expect(wrapper.find('button[type="submit"]').attributes('disabled')).toBeUndefined()
  })

  it('al elegir una moneda flotante distinta a la de la deuda, pide el equivalente aplicado y bloquea el envio hasta completarlo', async () => {
    const wrapper = mountForm()

    await wrapper.find('input[type="number"]').setValue('50')
    await wrapper.find('select').setValue('VEF')

    expect(wrapper.text()).toContain('Equivalente aplicado a la deuda (USD)')
    expect(wrapper.find('button[type="submit"]').attributes('disabled')).toBeDefined()

    const numberInputs = wrapper.findAll('input[type="number"]')
    await numberInputs[1].setValue('49.5')

    expect(wrapper.find('button[type="submit"]').attributes('disabled')).toBeUndefined()
  })

  it('el par USD/USDT esta atado 1:1 - nunca pide el equivalente aplicado', async () => {
    const wrapper = mountForm()

    await wrapper.find('input[type="number"]').setValue('50')
    await wrapper.find('select').setValue('USDT')

    expect(wrapper.text()).not.toContain('Equivalente aplicado')
    expect(wrapper.find('button[type="submit"]').attributes('disabled')).toBeUndefined()
  })

  it('al enviar con el par USD/USDT, no manda appliedAmount (el backend lo resuelve 1:1)', async () => {
    const wrapper = mountForm()

    await wrapper.find('input[type="number"]').setValue('50')
    await wrapper.find('select').setValue('USDT')
    await wrapper.find('form').trigger('submit')

    const input = wrapper.emitted('create')![0][0] as Record<string, unknown>
    expect(input.currency).toBe('USDT')
    expect(input.appliedAmount).toBeUndefined()
  })

  it('sin billeteras en la moneda elegida, no muestra el select de billetera', () => {
    const wrapper = mountForm()

    expect(wrapper.text()).not.toContain('Acreditar en billetera')
  })

  it('con una billetera en la misma moneda, la ofrece para acreditar', () => {
    const walletsStore = useWalletsStore()
    walletsStore.wallets.push({ id: 'wallet-1', name: 'Facebank', currency: 'USD', balance: 100, createdAt: '2026-08-01T00:00:00Z' })

    const wrapper = mountForm()

    expect(wrapper.text()).toContain('Acreditar en billetera')
    expect(wrapper.text()).toContain('Facebank')
  })

  it('al enviar, emite "create" con el input armado', async () => {
    const wrapper = mountForm()

    await wrapper.find('input[type="number"]').setValue('50')
    await wrapper.find('input[type="text"]').setValue('Zelle')
    await wrapper.find('form').trigger('submit')

    const emitted = wrapper.emitted('create')
    expect(emitted).toBeTruthy()
    const input = emitted![0][0] as Record<string, unknown>
    expect(input.amount).toBe(50)
    expect(input.currency).toBe('USD')
    expect(input.note).toBe('Zelle')
    expect(input.appliedAmount).toBeUndefined()
  })

  it('cancelar emite "cancel"', async () => {
    const wrapper = mountForm()

    await wrapper.findAll('button').find((button) => button.text() === 'Cancelar')!.trigger('click')

    expect(wrapper.emitted('cancel')).toBeTruthy()
  })

  it('el resultado de "Registrar por voz" precarga monto/moneda/fecha/nota', async () => {
    const wrapper = mountForm()

    await wrapper.find('.voice-stub').trigger('click')

    expect((wrapper.find('input[type="number"]').element as HTMLInputElement).value).toBe('50')
    expect((wrapper.find('select').element as HTMLSelectElement).value).toBe('USDT')
    expect((wrapper.find('input[type="date"]').element as HTMLInputElement).value).toBe('2026-08-25')
    expect((wrapper.find('input[type="text"]').element as HTMLInputElement).value).toBe('ayer me pagaron 50 usdt')
  })
})
