import { createPinia, setActivePinia } from 'pinia'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { listCategories } from '../../../services/categories/categories.service'
import type { Draft } from '../../../services/transactions/interfaces/transactions.interface'
import { confirmDraft, confirmDraftAsTransfer } from '../../../services/transactions/transactions.service'
import { useWalletsStore } from '../../../stores/wallets.store'
import DraftReviewCard from '../DraftReviewCard.vue'

vi.mock('../../../services/categories/categories.service', () => ({
  listCategories: vi.fn(),
  createCategory: vi.fn(),
  deleteCategory: vi.fn(),
  hideCategory: vi.fn(),
  unhideCategory: vi.fn(),
  CategoriesApiError: class CategoriesApiError extends Error {},
}))

vi.mock('../../../services/transactions/transactions.service', () => ({
  confirmDraft: vi.fn(),
  confirmDraftAsTransfer: vi.fn(),
  discardDraft: vi.fn(),
}))

const USDT = { id: 'w-usdt', name: 'Binance', currency: 'USDT', balance: 100, createdAt: '2026-01-01T00:00:00Z' }
const BS = { id: 'w-bs', name: 'BDV', currency: 'VEF', balance: 0, createdAt: '2026-01-01T00:00:00Z' }

// Pendiente guardado desde una captura: Bs recibidos de los que no se sabia cuantos USDT eran.
const PENDING: Draft = {
  id: 'draft-1',
  source: 'screenshot',
  rawInput: null,
  parsedAmount: 26600,
  parsedCurrency: 'VEF',
  parsedCategory: null,
  parsedDescription: 'Abono recibido otr bcos',
  suggestedWalletId: BS.id,
  txnType: 'income',
  occurredAt: '2026-10-08T21:58:00.000Z',
  fee: null,
  reference: '007608296806',
  status: 'pending',
  createdAt: '2026-10-09T10:00:00Z',
}

describe('DraftReviewCard con un pendiente de captura', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    useWalletsStore().wallets = [USDT, BS]
    vi.mocked(listCategories).mockReset().mockResolvedValue([])
    vi.mocked(confirmDraft).mockReset()
    vi.mocked(confirmDraftAsTransfer).mockReset().mockResolvedValue({ ...PENDING, status: 'confirmed' })
  })

  it('muestra la fecha y la referencia guardadas, y arranca con el tipo del pendiente', async () => {
    const wrapper = mount(DraftReviewCard, { props: { draft: PENDING } })
    await flushPromises()

    expect(wrapper.text()).toContain('2026-10-08')
    expect(wrapper.text()).toContain('Ref. 007608296806')
    expect((wrapper.findAll('select')[1]!.element as HTMLSelectElement).value).toBe('income')
  })

  it('ofrece completarlo como transferencia solo en un ingreso de captura', async () => {
    const wrapper = mount(DraftReviewCard, { props: { draft: PENDING } })
    await flushPromises()
    expect(wrapper.text()).toContain('Completar como transferencia')

    const voice = mount(DraftReviewCard, { props: { draft: { ...PENDING, source: 'voice' } } })
    await flushPromises()
    expect(voice.text()).not.toContain('Completar como transferencia')

    const expense = mount(DraftReviewCard, { props: { draft: { ...PENDING, txnType: 'expense' } } })
    await flushPromises()
    expect(expense.text()).not.toContain('Completar como transferencia')
  })

  it('completa la transferencia con lo que salio del origen y avisa con "transferred"', async () => {
    const wrapper = mount(DraftReviewCard, { props: { draft: PENDING } })
    await flushPromises()

    await wrapper.findAll('.draft-mode-chip')[1]!.trigger('click')
    expect(wrapper.text()).toContain('Billetera que recibió')
    // Sin origen ni monto enviado no se puede completar.
    const confirm = () => wrapper.findAll('button').find((button) => button.text() === 'Completar transferencia')!
    expect(confirm().attributes('disabled')).toBeDefined()

    await wrapper.findAll('select')[1]!.setValue(USDT.id)
    await wrapper.find('input[placeholder="Por ejemplo, los USDT"]').setValue(26.48)
    expect(confirm().attributes('disabled')).toBeUndefined()

    await confirm().trigger('click')
    await flushPromises()

    expect(confirmDraftAsTransfer).toHaveBeenCalledWith('draft-1', {
      fromWalletId: USDT.id,
      toWalletId: BS.id,
      sentAmount: 26.48,
      fee: undefined,
      occurredAt: '2026-10-08T21:58:00.000Z',
    })
    expect(wrapper.emitted('transferred')).toEqual([['draft-1']])
  })

  it('al confirmarlo como ingreso conserva la fecha y la comision guardadas', async () => {
    vi.mocked(confirmDraft).mockResolvedValue({ id: 'tx-1' } as never)
    const wrapper = mount(DraftReviewCard, { props: { draft: { ...PENDING, fee: 0.5 } } })
    await flushPromises()

    await wrapper.find('input[type="text"]').setValue('Otros ingresos')
    await wrapper.findAll('button').find((button) => button.text() === 'Confirmar')!.trigger('click')
    await flushPromises()

    expect(confirmDraft).toHaveBeenCalledWith(
      'draft-1',
      expect.objectContaining({ occurredAt: '2026-10-08T21:58:00.000Z', fee: 0.5, type: 'income', walletId: BS.id }),
    )
  })
})
