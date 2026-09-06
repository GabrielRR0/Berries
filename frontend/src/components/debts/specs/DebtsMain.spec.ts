import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useOnlineStatus } from '../../../composables/connectivity/useOnlineStatus'
import * as debtsService from '../../../services/debts/debts.service'
import * as walletsService from '../../../services/wallets/wallets.service'
import type { Debt } from '../../../services/debts/interfaces/debts.interface'
import { useOfflineQueueStore } from '../../../stores/offlineQueue.store'
import AddDebtPaymentForm from '../AddDebtPaymentForm.vue'
import DebtsMain from '../DebtsMain.vue'

vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }) }))

const DEBT: Debt = {
  id: 'debt-1',
  userId: 'user-1',
  counterpartyName: 'Juan',
  direction: 'owed_by_user',
  totalAmount: 5000,
  currency: 'CLP',
  description: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  installments: [],
  payments: [],
  amountPaid: 0,
  remainingAmount: 5000,
}

function mountDebtsMain() {
  return mount(DebtsMain, { global: { stubs: { CreateDebtForm: true } } })
}

describe('DebtsMain - registrar pago en modo offline', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
    vi.spyOn(debtsService, 'listDebts').mockResolvedValue([DEBT])
    vi.spyOn(debtsService, 'getDebtSummary').mockResolvedValue({ totalOwedByUser: 0, totalOwedToUser: 0 })
    vi.spyOn(debtsService, 'addDebtPayment').mockReset()
    vi.spyOn(walletsService, 'listWallets').mockResolvedValue([])
    useOnlineStatus().isOnline.value = true
  })

  it('online: registra el pago llamando al service, sin encolar nada', async () => {
    vi.mocked(debtsService.addDebtPayment).mockResolvedValue({
      id: 'p1',
      debtId: 'debt-1',
      amount: 100,
      currency: 'CLP',
      appliedAmount: 100,
      note: null,
      paidAt: '2026-01-01T00:00:00.000Z',
      walletId: null,
      createdAt: '2026-01-01T00:00:00.000Z',
    })
    const wrapper = mountDebtsMain()
    await flushPromises()

    await wrapper.find('.add-payment-trigger').trigger('click')
    await wrapper.findComponent(AddDebtPaymentForm).vm.$emit('create', { amount: 100, currency: 'CLP' })
    await flushPromises()

    expect(debtsService.addDebtPayment).toHaveBeenCalledWith('debt-1', { amount: 100, currency: 'CLP' })
    expect(useOfflineQueueStore().items).toHaveLength(0)
  })

  it('offline: encola el pago en vez de llamar al service, con el snapshot de la deuda', async () => {
    useOnlineStatus().isOnline.value = false
    const wrapper = mountDebtsMain()
    await flushPromises()

    await wrapper.find('.add-payment-trigger').trigger('click')
    await wrapper.findComponent(AddDebtPaymentForm).vm.$emit('create', { amount: 250, currency: 'CLP' })
    await flushPromises()

    expect(debtsService.addDebtPayment).not.toHaveBeenCalled()
    const offlineQueue = useOfflineQueueStore()
    expect(offlineQueue.items).toHaveLength(1)
    expect(offlineQueue.items[0]).toMatchObject({
      kind: 'debtPayment',
      debtId: 'debt-1',
      snapshot: { counterpartyName: 'Juan', debtDirection: 'owed_by_user', amount: 250, currency: 'CLP' },
    })
  })
})

async function flushPromises() {
  await new Promise((resolve) => setTimeout(resolve, 0))
  await Promise.resolve()
}
