import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import type { PendingDebtPayment, PendingGoalContribution, PendingTransaction, PendingTransfer } from '../../../stores/offlineQueue.store'
import PendingSyncCard from '../PendingSyncCard.vue'

const baseTransaction: PendingTransaction = {
  id: '1',
  kind: 'transaction',
  status: 'pending',
  createdAt: '2026-01-01T00:00:00.000Z',
  payload: { walletId: 'w1', type: 'expense', amount: 1000, category: 'comida' } as never,
  snapshot: { walletName: 'Efectivo', walletCurrency: 'CLP', type: 'expense', amount: 1000, category: 'comida' },
}

describe('PendingSyncCard', () => {
  it('muestra el resumen de un movimiento pendiente', () => {
    const wrapper = mount(PendingSyncCard, { props: { item: baseTransaction } })

    expect(wrapper.text()).toContain('Pendiente')
    expect(wrapper.text()).toContain('Efectivo')
    expect(wrapper.text()).toContain('comida')
  })

  it('muestra la advertencia fija en una transferencia (el dinero aun no se movio)', () => {
    const transfer: PendingTransfer = {
      id: '2',
      kind: 'transfer',
      status: 'pending',
      createdAt: '2026-01-01T00:00:00.000Z',
      payload: { fromWalletId: 'w1', toWalletId: 'w2', amount: 500 } as never,
      snapshot: { fromWalletName: 'Efectivo', toWalletName: 'Banco', fromCurrency: 'CLP', toCurrency: 'CLP', amount: 500 },
    }

    const wrapper = mount(PendingSyncCard, { props: { item: transfer } })

    expect(wrapper.text()).toContain('El dinero aún no se movió')
  })

  it('en estado syncing muestra el indicador de carga y ningun boton', () => {
    const item: PendingTransaction = { ...baseTransaction, status: 'syncing' }

    const wrapper = mount(PendingSyncCard, { props: { item } })

    expect(wrapper.text()).toContain('Sincronizando')
    expect(wrapper.findAll('button')).toHaveLength(0)
  })

  it('en estado failed muestra el error y los botones reintentar/descartar, y los emite', async () => {
    const item: PendingTransaction = { ...baseTransaction, status: 'failed', errorMessage: 'Billetera no encontrada' }

    const wrapper = mount(PendingSyncCard, { props: { item } })

    expect(wrapper.text()).toContain('Billetera no encontrada')
    const buttons = wrapper.findAll('button')
    expect(buttons).toHaveLength(2)

    await buttons[1].trigger('click')
    expect(wrapper.emitted('retry')?.[0]).toEqual(['1'])

    await buttons[0].trigger('click')
    expect(wrapper.emitted('discard')?.[0]).toEqual(['1'])
  })

  it('muestra el resumen de un pago de deuda y de un aporte de meta', () => {
    const debtPayment: PendingDebtPayment = {
      id: '3',
      kind: 'debtPayment',
      status: 'pending',
      createdAt: '2026-01-01T00:00:00.000Z',
      debtId: 'd1',
      payload: { amount: 2000, currency: 'CLP' } as never,
      snapshot: { counterpartyName: 'Juan', debtDirection: 'owed_by_user', amount: 2000, currency: 'CLP' },
    }
    const goalContribution: PendingGoalContribution = {
      id: '4',
      kind: 'goalContribution',
      status: 'pending',
      createdAt: '2026-01-01T00:00:00.000Z',
      goalId: 'g1',
      payload: { amountSaved: 3000 } as never,
      snapshot: { goalTitle: 'Viaje', goalCurrency: 'CLP', amountSaved: 3000 },
    }

    const debtWrapper = mount(PendingSyncCard, { props: { item: debtPayment } })
    const goalWrapper = mount(PendingSyncCard, { props: { item: goalContribution } })

    expect(debtWrapper.text()).toContain('Juan')
    expect(goalWrapper.text()).toContain('Viaje')
  })
})
