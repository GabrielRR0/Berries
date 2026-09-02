import { createPinia, setActivePinia } from 'pinia'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { listCategories } from '../../../services/categories/categories.service'
import { createTransaction } from '../../../services/transactions/transactions.service'
import type { Transaction } from '../../../services/transactions/interfaces/transactions.interface'
import { useWalletsStore } from '../../../stores/wallets.store'
import TransactionForm from '../TransactionForm.vue'

vi.mock('../../../services/categories/categories.service', () => ({
  listCategories: vi.fn(),
  createCategory: vi.fn(),
  deleteCategory: vi.fn(),
  hideCategory: vi.fn(),
  unhideCategory: vi.fn(),
}))

vi.mock('../../../services/transactions/transactions.service', () => ({
  createTransaction: vi.fn(),
}))

const WALLET = { id: 'wallet-1', name: 'Efectivo', currency: 'USD', balance: 500, createdAt: '2026-08-01T00:00:00Z' }

const CREATED: Transaction = {
  id: 'tx-1',
  walletId: 'wallet-1',
  type: 'expense',
  amount: 40,
  category: 'Comida',
  description: null,
  occurredAt: '2026-09-01T12:00:00Z',
  source: 'manual',
  transferId: null,
  createdAt: '2026-09-01T12:00:00Z',
}

// Bug real reportado por el usuario: "ayer olvidé registrar un gasto... no me sale
// ningún input para la fecha" - el form nunca tuvo un campo de fecha, siempre quedaba
// "ahora" aunque createTransaction() ya aceptaba un occurredAt opcional.
describe('TransactionForm', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    useWalletsStore().wallets = [WALLET]
    vi.mocked(listCategories).mockReset().mockResolvedValue([])
    vi.mocked(createTransaction).mockReset().mockResolvedValue(CREATED)
  })

  it('el campo de fecha arranca en el día de hoy', async () => {
    const wrapper = mount(TransactionForm)
    await flushPromises()

    const dateInput = wrapper.find('input[type="date"]')
    const today = new Date()
    const expected = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    expect((dateInput.element as HTMLInputElement).value).toBe(expected)
  })

  it('el campo de fecha no permite elegir un día futuro (max = hoy)', async () => {
    const wrapper = mount(TransactionForm)
    await flushPromises()

    const dateInput = wrapper.find('input[type="date"]')
    const today = new Date()
    const expected = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    expect((dateInput.element as HTMLInputElement).max).toBe(expected)
  })

  it('cambiar la fecha manda ese día en occurredAt al crear el movimiento', async () => {
    const wrapper = mount(TransactionForm)
    await flushPromises()

    await wrapper.find('select').setValue('wallet-1')
    await wrapper.find('input[type="number"]').setValue(40)
    await wrapper.find('input[type="date"]').setValue('2026-08-31') // "ayer" respecto al 2026-09-01
    await wrapper.find('input[maxlength="80"]').setValue('Comida')
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(createTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ occurredAt: expect.stringContaining('2026-08-31') }),
    )
  })

  it('sin tocar la fecha, occurredAt sigue siendo el día de hoy', async () => {
    const wrapper = mount(TransactionForm)
    await flushPromises()

    await wrapper.find('select').setValue('wallet-1')
    await wrapper.find('input[type="number"]').setValue(40)
    await wrapper.find('input[maxlength="80"]').setValue('Comida')
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    const today = new Date()
    const expected = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    expect(createTransaction).toHaveBeenCalledWith(expect.objectContaining({ occurredAt: expect.stringContaining(expected) }))
  })
})
