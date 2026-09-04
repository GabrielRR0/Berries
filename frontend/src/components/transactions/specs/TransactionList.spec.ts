import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import TransactionList from '../TransactionList.vue'

const WALLET_FACEBANK = { id: 'wallet-1', name: 'Facebank', currency: 'USD', balance: 100, createdAt: '2026-08-01T00:00:00Z' }
const WALLET_BINANCE = { id: 'wallet-2', name: 'Binance', currency: 'USD', balance: 0, createdAt: '2026-08-01T00:00:00Z' }
const WALLETS = [WALLET_FACEBANK, WALLET_BINANCE]

const MANUAL_EXPENSE = {
  id: 'tx-1',
  walletId: 'wallet-1',
  type: 'expense' as const,
  amount: 30,
  category: 'comida',
  description: null,
  occurredAt: '2026-08-05T12:00:00Z',
  source: 'manual',
  transferId: null,
  referenceAmountUsd: null,
  createdAt: '2026-08-05T12:00:00Z',
}

const TRANSFER_FROM_LEG = {
  id: 'tx-2',
  walletId: 'wallet-1',
  type: 'expense' as const,
  amount: 40,
  category: 'Transferencia',
  description: 'Transferencia a Binance',
  occurredAt: '2026-08-06T12:00:00Z',
  source: 'transfer',
  transferId: 'transfer-1',
  referenceAmountUsd: null,
  createdAt: '2026-08-06T12:00:00Z',
}

const TRANSFER_TO_LEG = {
  id: 'tx-3',
  walletId: 'wallet-2',
  type: 'income' as const,
  amount: 40,
  category: 'Transferencia',
  description: 'Transferencia desde Facebank',
  occurredAt: '2026-08-06T12:00:00Z',
  source: 'transfer',
  transferId: 'transfer-1',
  referenceAmountUsd: null,
  createdAt: '2026-08-06T12:00:00Z',
}

const TRANSFER_FEE_LEG = {
  id: 'tx-4',
  walletId: 'wallet-1',
  type: 'expense' as const,
  amount: 2,
  category: 'Comisión',
  description: 'Comisión de transferencia a Binance',
  occurredAt: '2026-08-06T12:00:00Z',
  source: 'manual',
  transferId: 'transfer-1',
  referenceAmountUsd: null,
  createdAt: '2026-08-06T12:00:00Z',
}

describe('TransactionList', () => {
  it('muestra "¿Eliminar?" para un movimiento manual al pedir confirmacion', async () => {
    const wrapper = mount(TransactionList, { props: { transactions: [MANUAL_EXPENSE], wallets: WALLETS } })

    await wrapper.find('.transaction-delete-trigger').trigger('click')

    expect(wrapper.find('.transaction-confirm-text').text()).toBe('¿Eliminar?')
  })

  it('emite "delete" con el id al confirmar un movimiento manual', async () => {
    const wrapper = mount(TransactionList, { props: { transactions: [MANUAL_EXPENSE], wallets: WALLETS } })

    await wrapper.find('.transaction-delete-trigger').trigger('click')
    await wrapper.find('.transaction-confirm-delete').trigger('click')

    expect(wrapper.emitted('delete')).toEqual([['tx-1']])
  })

  // "Editar" - pedido explicito del usuario ("se debe poder editar los
  // movimientos... montos, fecha de pago, description, wallet_id, category").
  it('emite "edit" con la transaction al tocar Editar en un movimiento manual', async () => {
    const wrapper = mount(TransactionList, { props: { transactions: [MANUAL_EXPENSE], wallets: WALLETS } })

    await wrapper.find('.transaction-edit-trigger').trigger('click')

    expect(wrapper.emitted('edit')).toEqual([[MANUAL_EXPENSE]])
  })

  it('no muestra "Editar" para una transferencia fusionada', () => {
    const wrapper = mount(TransactionList, {
      props: { transactions: [TRANSFER_FROM_LEG, TRANSFER_TO_LEG, TRANSFER_FEE_LEG], wallets: WALLETS },
    })

    expect(wrapper.find('.transaction-edit-trigger').exists()).toBe(false)
  })

  it('no muestra "Editar" para una pata de transferencia mostrada suelta (ej. la comisión sin sus otras patas presentes)', () => {
    // Sin fromLeg/toLeg en la lista, la comisión se muestra "suelta" (kind: 'single')
    // en vez de fusionada - igual no debe ofrecer Editar (transferId no es null).
    const wrapper = mount(TransactionList, { props: { transactions: [TRANSFER_FEE_LEG], wallets: WALLETS } })

    expect(wrapper.find('.transaction-edit-trigger').exists()).toBe(false)
    expect(wrapper.find('.transaction-delete-trigger').exists()).toBe(true)
  })

  it('un gasto manual muestra signo "-" y el icono en rojo', () => {
    const wrapper = mount(TransactionList, { props: { transactions: [MANUAL_EXPENSE], wallets: WALLETS } })

    expect(wrapper.find('.transaction-amount').text()).toContain('-')
    expect(wrapper.find('.transaction-amount').classes()).toContain('expense')
    expect(wrapper.find('.icon-badge').classes()).toContain('expense')
  })

  // reference_amount_usd (ver create_transaction del backend) - pedido explicito del
  // usuario: para un gasto en una moneda nacional (VEF, COP, ARS...) quiere ver a
  // simple vista cuanto era eso en dolares el dia que ocurrio, de forma fija.
  it('muestra el valor de referencia en USD cuando la wallet no esta en USD', () => {
    const expenseInVef = { ...MANUAL_EXPENSE, referenceAmountUsd: 5.1 }
    const wrapper = mount(TransactionList, { props: { transactions: [expenseInVef], wallets: WALLETS } })

    expect(wrapper.find('.transaction-reference').exists()).toBe(true)
    expect(wrapper.find('.transaction-reference').text()).toContain('$5.10')
  })

  it('no muestra ningun valor de referencia cuando la wallet ya esta en USD', () => {
    const wrapper = mount(TransactionList, { props: { transactions: [MANUAL_EXPENSE], wallets: WALLETS } })

    expect(wrapper.find('.transaction-reference').exists()).toBe(false)
  })

  // Si un filtro externo (busqueda, categoria) deja visible solo UNA pata de
  // una transferencia, se muestra suelta en vez de forzar una fusion a
  // medias - mismo tratamiento neutro que la card fusionada.
  describe('una pata de transferencia sin su contraparte visible', () => {
    it('no muestra signo +/- ni el icono en rojo', () => {
      const wrapper = mount(TransactionList, { props: { transactions: [TRANSFER_FROM_LEG], wallets: WALLETS } })

      const amountText = wrapper.find('.transaction-amount').text()
      expect(amountText.startsWith('+') || amountText.startsWith('-')).toBe(false)
      expect(wrapper.find('.transaction-amount').classes()).not.toContain('expense')
      expect(wrapper.find('.icon-badge').classes()).not.toContain('expense')
      expect(wrapper.find('.icon-badge').classes()).toContain('neutral')
    })

    it('muestra "¿Eliminar transferencia?" al pedir confirmacion', async () => {
      const wrapper = mount(TransactionList, { props: { transactions: [TRANSFER_FROM_LEG], wallets: WALLETS } })

      await wrapper.find('.transaction-delete-trigger').trigger('click')

      expect(wrapper.find('.transaction-confirm-text').text()).toBe('¿Eliminar transferencia?')
    })
  })

  // Pedido explicito del usuario: una transferencia completa (ambas patas
  // presentes) debe verse como UNA sola fila "origen → destino", no dos
  // filas separadas que parecen un gasto y un ingreso reales.
  describe('una transferencia completa (ambas patas presentes)', () => {
    it('se fusiona en una sola card con el titulo "origen → destino"', () => {
      const wrapper = mount(TransactionList, {
        props: { transactions: [TRANSFER_FROM_LEG, TRANSFER_TO_LEG], wallets: WALLETS },
      })

      expect(wrapper.findAll('.transaction-item')).toHaveLength(1)
      expect(wrapper.find('.transaction-category').text()).toBe('Facebank → Binance')
    })

    it('sin comision, el monto principal se muestra chico y sin costo destacado', () => {
      const wrapper = mount(TransactionList, {
        props: { transactions: [TRANSFER_FROM_LEG, TRANSFER_TO_LEG], wallets: WALLETS },
      })

      expect(wrapper.find('.transaction-amount').classes()).not.toContain('expense')
      expect(wrapper.find('.transaction-amount').text()).not.toMatch(/^[+-]/)
      expect(wrapper.find('.transaction-description').text()).toContain('$40.00 transferidos')
    })

    it('con comision, el monto grande es la comision (gasto real) y el principal queda en chico', () => {
      const wrapper = mount(TransactionList, {
        props: { transactions: [TRANSFER_FROM_LEG, TRANSFER_TO_LEG, TRANSFER_FEE_LEG], wallets: WALLETS },
      })

      expect(wrapper.findAll('.transaction-item')).toHaveLength(1)
      expect(wrapper.find('.transaction-amount').text()).toBe('-$2.00')
      expect(wrapper.find('.transaction-amount').classes()).toContain('expense')
      expect(wrapper.find('.transaction-description').text()).toContain('$40.00 transferidos')
    })

    it('pide confirmacion como transferencia y borra usando el id de una de las patas', async () => {
      const wrapper = mount(TransactionList, {
        props: { transactions: [TRANSFER_FROM_LEG, TRANSFER_TO_LEG, TRANSFER_FEE_LEG], wallets: WALLETS },
      })

      await wrapper.find('.transaction-delete-trigger').trigger('click')
      expect(wrapper.find('.transaction-confirm-text').text()).toBe('¿Eliminar transferencia?')

      await wrapper.find('.transaction-confirm-delete').trigger('click')
      expect(wrapper.emitted('delete')).toEqual([['tx-2']])
    })
  })
})
