import { createPinia, setActivePinia } from 'pinia'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { listCategories } from '../../../services/categories/categories.service'
import { confirmDraft } from '../../../services/transactions/transactions.service'
import type { Draft } from '../../../services/transactions/interfaces/transactions.interface'
import { useWalletsStore } from '../../../stores/wallets.store'
import DraftReviewCard from '../DraftReviewCard.vue'

vi.mock('../../../services/categories/categories.service', () => ({
  listCategories: vi.fn(),
  createCategory: vi.fn(),
  deleteCategory: vi.fn(),
  hideCategory: vi.fn(),
  unhideCategory: vi.fn(),
}))

vi.mock('../../../services/transactions/transactions.service', () => ({
  confirmDraft: vi.fn(),
  discardDraft: vi.fn(),
}))

const CASH_USD = { id: 'wallet-cash', name: 'Cash', currency: 'USD', balance: 100, createdAt: '2026-08-01T00:00:00Z' }
const BINANCE_USDT = { id: 'wallet-binance', name: 'Binance', currency: 'USDT', balance: 0, createdAt: '2026-08-01T00:00:00Z' }
const NU_USDT = { id: 'wallet-nu', name: 'Nu', currency: 'USDT', balance: 0, createdAt: '2026-08-01T00:00:00Z' }

const DRAFT: Draft = {
  id: 'draft-1',
  source: 'voice',
  rawInput: 'gasté 41 USDT para pagar el gimnasio',
  parsedAmount: 41,
  parsedCurrency: 'USDT',
  parsedCategory: 'Gym',
  parsedDescription: 'gasté 41 USDT para pagar el gimnasio',
  suggestedWalletId: null,
  status: 'pending',
  createdAt: '2026-08-28T00:00:00Z',
}

describe('DraftReviewCard', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.mocked(listCategories).mockReset().mockResolvedValue([])
    vi.mocked(confirmDraft).mockReset()
  })

  // Bug real reportado: el usuario dicta un gasto y la wallet correcta (misma
  // moneda que detectó el parser) no queda preseleccionada, obligando a elegirla
  // a mano cada vez pese a que solo hay una wallet posible.
  it('preselecciona la wallet cuando su moneda es la unica que matchea la moneda detectada', () => {
    useWalletsStore().wallets = [CASH_USD, BINANCE_USDT]

    const wrapper = mount(DraftReviewCard, { props: { draft: DRAFT } })

    expect(wrapper.find('select').element.value).toBe('wallet-binance')
  })

  it('no preselecciona nada si mas de una wallet comparte esa moneda (ambiguo)', () => {
    useWalletsStore().wallets = [BINANCE_USDT, NU_USDT]

    const wrapper = mount(DraftReviewCard, { props: { draft: DRAFT } })

    expect(wrapper.find('select').element.value).toBe('')
  })

  it('no preselecciona nada si ninguna wallet coincide con la moneda detectada', () => {
    useWalletsStore().wallets = [CASH_USD]

    const wrapper = mount(DraftReviewCard, { props: { draft: DRAFT } })

    expect(wrapper.find('select').element.value).toBe('')
  })

  it('preselecciona la wallet de suggestedWalletId, con prioridad sobre la moneda', () => {
    useWalletsStore().wallets = [CASH_USD, BINANCE_USDT, NU_USDT]

    const wrapper = mount(DraftReviewCard, {
      props: { draft: { ...DRAFT, suggestedWalletId: 'wallet-nu' } },
    })

    expect(wrapper.find('select').element.value).toBe('wallet-nu')
  })

  it('muestra el saldo de cada wallet en el selector', () => {
    useWalletsStore().wallets = [CASH_USD]

    const wrapper = mount(DraftReviewCard, { props: { draft: DRAFT } })

    expect(wrapper.find('option[value="wallet-cash"]').text()).toContain('$100.00')
  })

  it('el boton Max carga el saldo de la wallet seleccionada como monto', async () => {
    useWalletsStore().wallets = [{ ...BINANCE_USDT, balance: 77.5 }]

    const wrapper = mount(DraftReviewCard, { props: { draft: DRAFT } })
    await wrapper.find('.max-amount-trigger').trigger('click')

    expect((wrapper.find('input[type="number"]').element as HTMLInputElement).value).toBe('77.5')
  })

  it('avisa cuando el monto supera el saldo de la wallet (gasto)', async () => {
    useWalletsStore().wallets = [{ ...BINANCE_USDT, balance: 10 }]

    const wrapper = mount(DraftReviewCard, { props: { draft: { ...DRAFT, parsedAmount: 41 } } })

    expect(wrapper.find('.draft-balance-warning').exists()).toBe(true)
  })

  it('no avisa cuando el monto entra en el saldo de la wallet', async () => {
    useWalletsStore().wallets = [{ ...BINANCE_USDT, balance: 1000 }]

    const wrapper = mount(DraftReviewCard, { props: { draft: DRAFT } })

    expect(wrapper.find('.draft-balance-warning').exists()).toBe(false)
  })

  it('precarga la categoria sugerida por el parser', () => {
    useWalletsStore().wallets = [CASH_USD]

    const wrapper = mount(DraftReviewCard, { props: { draft: DRAFT } })

    expect((wrapper.find('.category-field input').element as HTMLInputElement).value).toBe('Gym')
  })

  it('confirma el borrador con los datos del formulario', async () => {
    useWalletsStore().wallets = [BINANCE_USDT]
    vi.mocked(confirmDraft).mockResolvedValue({
      id: 'tx-1',
      walletId: 'wallet-binance',
      type: 'expense',
      amount: 41,
      category: 'Gym',
      description: 'gasté 41 USDT para pagar el gimnasio',
      occurredAt: '2026-08-28T00:00:00Z',
      source: 'voice',
      transferId: null,
      createdAt: '2026-08-28T00:00:00Z',
    })

    const wrapper = mount(DraftReviewCard, { props: { draft: DRAFT } })
    await flushPromises()

    await wrapper.findAll('button').find((button) => button.text() === 'Confirmar')!.trigger('click')
    await flushPromises()

    expect(confirmDraft).toHaveBeenCalledWith('draft-1', {
      walletId: 'wallet-binance',
      type: 'expense',
      finalAmount: 41,
      finalCategory: 'Gym',
      finalDescription: 'gasté 41 USDT para pagar el gimnasio',
    })
    expect(wrapper.emitted('confirmed')).toBeTruthy()
  })
})
