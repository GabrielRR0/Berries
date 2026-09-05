import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import type { GoalCheckIn } from '../../../services/goals/interfaces/goals.interface'
import GoalCheckInEditSheet from '../GoalCheckInEditSheet.vue'

const WALLET_USD = { id: 'wallet-1', name: 'Efectivo', currency: 'USD', balance: 1000, createdAt: '2026-01-01T00:00:00Z' }
const WALLET_EUR = { id: 'wallet-2', name: 'Banco EUR', currency: 'EUR', balance: 500, createdAt: '2026-01-01T00:00:00Z' }

const FUTURE_CHECK_IN: GoalCheckIn = {
  id: 'ci-1',
  goalId: 'goal-1',
  periodMonth: '2026-09-01',
  amountSaved: 50,
  previousTargetDate: null,
  newTargetDate: null,
  note: 'venta de la laptop',
  walletId: null,
  createdAt: '2026-09-01T00:00:00Z',
}

const LINKED_CHECK_IN: GoalCheckIn = { ...FUTURE_CHECK_IN, id: 'ci-2', walletId: 'wallet-1', note: null }

// Pedido explicito del usuario: "yo quiero ir a metas y en ese aporte editarlo y
// decir que los voy a usar de mi billetera" - solo billetera/nota, nunca monto/fecha.
describe('GoalCheckInEditSheet', () => {
  it('arranca en "Ingreso futuro" para un aporte sin billetera enlazada', () => {
    const wrapper = mount(GoalCheckInEditSheet, {
      props: { checkIn: FUTURE_CHECK_IN, goalCurrency: 'USD', wallets: [WALLET_USD], walletCommitments: {} },
    })

    expect(wrapper.find('.pill.active').text()).toBe('Ingreso futuro')
    expect((wrapper.find('input[type="text"]').element as HTMLInputElement).value).toBe('venta de la laptop')
  })

  it('arranca en "Billetera" con la billetera ya elegida para un aporte ya enlazado', () => {
    const wrapper = mount(GoalCheckInEditSheet, {
      props: { checkIn: LINKED_CHECK_IN, goalCurrency: 'USD', wallets: [WALLET_USD], walletCommitments: {} },
    })

    expect(wrapper.find('.pill.active').text()).toBe('Billetera')
    expect((wrapper.find('select').element as HTMLSelectElement).value).toBe('wallet-1')
  })

  it('el selector solo ofrece billeteras de la misma moneda que la meta', async () => {
    const wrapper = mount(GoalCheckInEditSheet, {
      props: { checkIn: FUTURE_CHECK_IN, goalCurrency: 'USD', wallets: [WALLET_USD, WALLET_EUR], walletCommitments: {} },
    })

    await wrapper.findAll('.pill').find((btn) => btn.text() === 'Billetera')!.trigger('click')

    const options = wrapper.find('select').findAll('option').map((o) => o.text())
    expect(options.some((text) => text.includes('Efectivo'))).toBe(true)
    expect(options.some((text) => text.includes('Banco EUR'))).toBe(false)
  })

  it('emite "save" con el walletId y la nota elegidos', async () => {
    const wrapper = mount(GoalCheckInEditSheet, {
      props: { checkIn: FUTURE_CHECK_IN, goalCurrency: 'USD', wallets: [WALLET_USD], walletCommitments: {} },
    })

    await wrapper.findAll('.pill').find((btn) => btn.text() === 'Billetera')!.trigger('click')
    await wrapper.find('select').setValue('wallet-1')

    const saveButton = wrapper.findAll('button').find((btn) => btn.text() === 'Guardar cambios')!
    await saveButton.trigger('click')

    expect(wrapper.emitted('save')).toBeTruthy()
    const [input] = wrapper.emitted('save')!.at(-1) as [unknown]
    expect(input).toEqual({ walletId: 'wallet-1', note: null })
  })

  it('bloquea "Guardar cambios" si la billetera elegida no tiene disponible suficiente', async () => {
    const wrapper = mount(GoalCheckInEditSheet, {
      props: {
        checkIn: FUTURE_CHECK_IN, // amountSaved: 50
        goalCurrency: 'USD',
        wallets: [WALLET_USD],
        walletCommitments: { 'wallet-1': 980 }, // disponible: 1000 - 980 = 20
      },
    })

    await wrapper.findAll('.pill').find((btn) => btn.text() === 'Billetera')!.trigger('click')
    await wrapper.find('select').setValue('wallet-1')

    const saveButton = wrapper.findAll('button').find((btn) => btn.text() === 'Guardar cambios')!
    expect(saveButton.attributes('disabled')).toBeDefined()
    expect(wrapper.find('.check-in-edit-hint.warning').exists()).toBe(true)
  })

  // exclude_check_in_id (cliente): re-enlazar la MISMA billetera a la que este
  // aporte ya estaba enlazado no debe rechazarse contra su propio monto.
  it('reconfirmar la billetera a la que ya estaba enlazado no se rechaza a si mismo', async () => {
    const wrapper = mount(GoalCheckInEditSheet, {
      props: {
        checkIn: LINKED_CHECK_IN, // amountSaved: 50, ya enlazado a wallet-1
        goalCurrency: 'USD',
        wallets: [WALLET_USD],
        // Comprometido total incluye el propio aporte de LINKED_CHECK_IN (50) - sin
        // sumarselo de nuevo el disponible real es 1000 - 50 = 950.
        walletCommitments: { 'wallet-1': 50 },
      },
    })

    const saveButton = wrapper.findAll('button').find((btn) => btn.text() === 'Guardar cambios')!
    expect(saveButton.attributes('disabled')).toBeUndefined()
  })

  it('emite "cancel" al tocar Cancelar', async () => {
    const wrapper = mount(GoalCheckInEditSheet, {
      props: { checkIn: FUTURE_CHECK_IN, goalCurrency: 'USD', wallets: [WALLET_USD], walletCommitments: {} },
    })

    await wrapper.findAll('button').find((btn) => btn.text() === 'Cancelar')!.trigger('click')

    expect(wrapper.emitted('cancel')).toBeTruthy()
  })
})
