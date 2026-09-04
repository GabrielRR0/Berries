import { createPinia, setActivePinia } from 'pinia'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { listCategories } from '../../../services/categories/categories.service'
import { createTransaction, updateTransaction } from '../../../services/transactions/transactions.service'
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
  updateTransaction: vi.fn(),
}))

const WALLET = { id: 'wallet-1', name: 'Efectivo', currency: 'USD', balance: 500, createdAt: '2026-08-01T00:00:00Z' }
const OTHER_WALLET = { id: 'wallet-2', name: 'Banco', currency: 'USD', balance: 200, createdAt: '2026-08-01T00:00:00Z' }

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
  referenceAmountUsd: null,
  createdAt: '2026-09-01T12:00:00Z',
}

// Bug real reportado por el usuario: "ayer olvidé registrar un gasto... no me sale
// ningún input para la fecha" - el form nunca tuvo un campo de fecha, siempre quedaba
// "ahora" aunque createTransaction() ya aceptaba un occurredAt opcional.
describe('TransactionForm', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    useWalletsStore().wallets = [WALLET, OTHER_WALLET]
    vi.mocked(listCategories).mockReset().mockResolvedValue([])
    vi.mocked(createTransaction).mockReset().mockResolvedValue(CREATED)
    vi.mocked(updateTransaction).mockReset().mockResolvedValue(CREATED)
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

    // No se compara el string ISO crudo: occurredAt combina la fecha elegida con la
    // hora LOCAL actual (ver buildOccurredAt() en TransactionForm.vue) y toISOString()
    // pasa a UTC, así que la porción de FECHA del ISO puede correrse un día respecto al
    // string local elegido según la hora y el huso horario en que corra el test (bug de
    // test real, no de la app - encontrado porque este archivo asumía que "2026-08-31"
    // local siempre aparecía tal cual en el ISO, algo que deja de cumplirse de noche en
    // husos horarios negativos). Se reconstruye la fecha LOCAL a partir del ISO
    // recibido y se compara componente a componente, mismo criterio que usa el propio
    // componente para construirla.
    const [sentOccurredAt] = vi.mocked(createTransaction).mock.calls[0]!
    const sentDate = new Date(sentOccurredAt.occurredAt!)
    expect(sentDate.getFullYear()).toBe(2026)
    expect(sentDate.getMonth()).toBe(7) // agosto (0-indexado)
    expect(sentDate.getDate()).toBe(31)
  })

  it('sin tocar la fecha, occurredAt sigue siendo el día de hoy', async () => {
    const wrapper = mount(TransactionForm)
    await flushPromises()

    await wrapper.find('select').setValue('wallet-1')
    await wrapper.find('input[type="number"]').setValue(40)
    await wrapper.find('input[maxlength="80"]').setValue('Comida')
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    // Mismo criterio que el test de arriba: se compara la fecha LOCAL reconstruida del
    // ISO recibido contra "hoy" en vez del string ISO crudo.
    const today = new Date()
    const [sentOccurredAt] = vi.mocked(createTransaction).mock.calls[0]!
    const sentDate = new Date(sentOccurredAt.occurredAt!)
    expect(sentDate.getFullYear()).toBe(today.getFullYear())
    expect(sentDate.getMonth()).toBe(today.getMonth())
    expect(sentDate.getDate()).toBe(today.getDate())
  })

  // Modo edicion (editingTransaction) - pedido explicito del usuario: "se debe poder
  // editar los movimientos... montos, fecha de pago, description, wallet_id,
  // category todo lo necesario". El MISMO form sirve para crear y editar.
  describe('modo edicion (editingTransaction)', () => {
    const EXISTING: Transaction = {
      id: 'tx-existing',
      walletId: 'wallet-1',
      type: 'income',
      amount: 200,
      category: 'Salario',
      description: 'Quincena',
      occurredAt: '2026-01-15T12:00:00Z',
      source: 'manual',
      transferId: null,
      referenceAmountUsd: null,
      createdAt: '2026-01-15T12:00:00Z',
    }

    it('precarga todos los campos con los valores de la transaction existente', async () => {
      const wrapper = mount(TransactionForm, { props: { editingTransaction: EXISTING } })
      await flushPromises()

      expect((wrapper.find('select').element as HTMLSelectElement).value).toBe('wallet-1')
      expect((wrapper.find('input[type="number"]').element as HTMLInputElement).valueAsNumber).toBe(200)
      expect((wrapper.find('input[maxlength="80"]').element as HTMLInputElement).value).toBe('Salario')
      expect((wrapper.find('input[placeholder="Detalle del movimiento"]').element as HTMLInputElement).value).toBe(
        'Quincena',
      )
      expect(wrapper.find('.type-option.active').text()).toBe('Ingreso')
      // Fecha PROPIA de la transaction (15 de enero), no "hoy".
      expect((wrapper.find('input[type="date"]').element as HTMLInputElement).value).toBe('2026-01-15')
    })

    it('el título y el botón dicen "editar" en vez de "nuevo"/"guardar"', async () => {
      const wrapper = mount(TransactionForm, { props: { editingTransaction: EXISTING } })
      await flushPromises()

      expect(wrapper.find('.form-title').text()).toBe('Editar movimiento')
      expect(wrapper.find('button[type="submit"]').text()).toBe('Guardar cambios')
    })

    it('al guardar, llama a updateTransaction (no createTransaction) con el id existente y emite "updated"', async () => {
      const wrapper = mount(TransactionForm, { props: { editingTransaction: EXISTING } })
      await flushPromises()

      await wrapper.find('input[type="number"]').setValue(250)
      await wrapper.find('form').trigger('submit.prevent')
      await flushPromises()

      expect(createTransaction).not.toHaveBeenCalled()
      expect(updateTransaction).toHaveBeenCalledWith(
        'tx-existing',
        expect.objectContaining({ walletId: 'wallet-1', type: 'income', amount: 250, category: 'Salario' }),
      )
      expect(wrapper.emitted('updated')).toBeTruthy()
      expect(wrapper.emitted('created')).toBeFalsy()
    })

    it('permite cambiar la wallet del movimiento', async () => {
      const wrapper = mount(TransactionForm, { props: { editingTransaction: EXISTING } })
      await flushPromises()

      await wrapper.find('select').setValue('wallet-2')
      await wrapper.find('form').trigger('submit.prevent')
      await flushPromises()

      expect(updateTransaction).toHaveBeenCalledWith('tx-existing', expect.objectContaining({ walletId: 'wallet-2' }))
    })
  })
})
