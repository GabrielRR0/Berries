import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { DOMWrapper, mount } from '@vue/test-utils'
import type { Debt } from '../../../services/debts/interfaces/debts.interface'
import DebtCard from '../DebtCard.vue'

// El sheet de historial se teletransporta a <body> (Teleport, ver DebtCard.vue -
// escapa el hover:transform de BaseCard). attachTo: document.body monta la card
// en el DOM real para que ese contenido teletransportado sea visible via
// DOMWrapper(document.body); hay que desmontar cada uno despues para no dejar
// sheets huerfanos pegados al body real entre tests (mismo patron que
// GoalCard.spec.ts).
const mountedWrappers: ReturnType<typeof mount>[] = []
function mountAttached(props: { debt: Debt }) {
  const wrapper = mount(DebtCard, { props, attachTo: document.body })
  mountedWrappers.push(wrapper)
  return wrapper
}

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
  payments: [],
  amountPaid: 0,
  remainingAmount: 50,
}

describe('DebtCard', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  afterEach(() => {
    for (const wrapper of mountedWrappers.splice(0)) wrapper.unmount()
  })

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

  it('el boton "Registrar pago" emite "openAddPayment"', async () => {
    const wrapper = mount(DebtCard, { props: { debt: DEBT } })

    await wrapper.find('.add-payment-trigger').trigger('click')

    expect(wrapper.emitted('openAddPayment')).toBeTruthy()
  })

  it('sin pagos registrados no muestra el trigger de historial ni "Resta"', () => {
    const wrapper = mount(DebtCard, { props: { debt: DEBT } })

    expect(wrapper.find('.payment-history-trigger').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Resta')
  })

  it('con pagos registrados muestra un resumen compacto (no el listado directo) y cuanto resta', () => {
    const debtWithPayments = {
      ...DEBT,
      amountPaid: 20,
      remainingAmount: 30,
      payments: [
        {
          id: 'payment-1',
          debtId: 'debt-1',
          amount: 20,
          currency: 'USD',
          appliedAmount: 20,
          note: null,
          paidAt: '2026-08-30',
          walletId: null,
          createdAt: '2026-08-30T00:00:00Z',
        },
      ],
    }

    const wrapper = mount(DebtCard, { props: { debt: debtWithPayments } })

    expect(wrapper.find('.payment-history-trigger').exists()).toBe(true)
    expect(wrapper.text()).toContain('1 pago registrado')
    expect(wrapper.find('.payment-history').exists()).toBe(false)
    expect(wrapper.text()).toContain('Resta')
  })

  it('tocar el resumen abre el historial completo en un sheet', async () => {
    const debtWithPayments = {
      ...DEBT,
      amountPaid: 20,
      remainingAmount: 30,
      payments: [
        {
          id: 'payment-1',
          debtId: 'debt-1',
          amount: 20,
          currency: 'USD',
          appliedAmount: 20,
          note: null,
          paidAt: '2026-08-30',
          walletId: null,
          createdAt: '2026-08-30T00:00:00Z',
        },
      ],
    }

    const wrapper = mountAttached({ debt: debtWithPayments })
    await wrapper.find('.payment-history-trigger').trigger('click')

    // El sheet vive dentro de un <Teleport to="body">, asi que su contenido
    // esta fuera del subarbol de wrapper - hay que buscarlo directo en el
    // document.body (mismo patron que GoalCard.spec.ts para su dropdown).
    expect(new DOMWrapper(document.body).find('.payment-history').exists()).toBe(true)
  })

  it('eliminar un pago del historial (dentro del sheet) emite "removePayment" con su id', async () => {
    const debtWithPayments = {
      ...DEBT,
      amountPaid: 20,
      remainingAmount: 30,
      payments: [
        {
          id: 'payment-1',
          debtId: 'debt-1',
          amount: 20,
          currency: 'USD',
          appliedAmount: 20,
          note: null,
          paidAt: '2026-08-30',
          walletId: null,
          createdAt: '2026-08-30T00:00:00Z',
        },
      ],
    }

    const wrapper = mountAttached({ debt: debtWithPayments })
    await wrapper.find('.payment-history-trigger').trigger('click')

    const body = new DOMWrapper(document.body)
    await body.find('.payment-remove-trigger').trigger('click')
    await body.find('.payment-confirm-delete').trigger('click')

    expect(wrapper.emitted('removePayment')).toEqual([['payment-1']])
  })
})
