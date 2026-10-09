import { createPinia, setActivePinia } from 'pinia'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { recognizeScreenshot } from '../../../services/screenshotScan/screenshot-scan.service'
import { createDraftsBulk, createTransactionsBulk } from '../../../services/transactions/transactions.service'
import { useTransactionsStore } from '../../../stores/transactions.store'
import { useWalletsStore } from '../../../stores/wallets.store'
import { BANK_WORDS, isGreen, layoutOf } from '../../../utils/screenshotScan/specs/listFixtures'
import BulkCaptureWizard from '../BulkCaptureWizard.vue'

vi.mock('../../../services/screenshotScan/screenshot-scan.service', () => ({ recognizeScreenshot: vi.fn() }))
vi.mock('../../../services/transactions/transactions.service', () => ({
  createTransactionsBulk: vi.fn(),
  createDraftsBulk: vi.fn(),
  listTransactions: vi.fn(),
}))
vi.mock('../../../services/categories/categories.service', () => ({
  listCategories: vi.fn().mockResolvedValue([]),
  createCategory: vi.fn(),
  deleteCategory: vi.fn(),
  hideCategory: vi.fn(),
  unhideCategory: vi.fn(),
  CategoriesApiError: class CategoriesApiError extends Error {},
}))

const BS = { id: 'w-bs', name: 'BDV', currency: 'VEF', balance: 90000, createdAt: '2026-01-01T00:00:00Z' }
const USD = { id: 'w-usd', name: 'Efectivo', currency: 'USD', balance: 50, createdAt: '2026-01-01T00:00:00Z' }

async function pickImage(wrapper: ReturnType<typeof mount>) {
  const input = wrapper.find('input[type="file"]')
  Object.defineProperty(input.element, 'files', {
    value: [new File(['x'], 'captura.png', { type: 'image/png' })],
    configurable: true,
  })
  await input.trigger('change')
  await flushPromises()
}

function continueButton(wrapper: ReturnType<typeof mount>) {
  return wrapper.find('.wizard-next')
}

describe('BulkCaptureWizard', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 9, 9, 12, 0, 0))
    URL.createObjectURL = vi.fn(() => 'blob:preview')
    URL.revokeObjectURL = vi.fn()

    const wallets = useWalletsStore()
    wallets.wallets = [BS, USD]
    vi.spyOn(wallets, 'fetchWallets').mockResolvedValue(undefined)
    vi.spyOn(useTransactionsStore(), 'fetchTransactions').mockResolvedValue(undefined)

    vi.mocked(recognizeScreenshot).mockReset().mockResolvedValue(layoutOf(BANK_WORDS, 924, isGreen))
    vi.mocked(createTransactionsBulk).mockReset().mockResolvedValue([])
    vi.mocked(createDraftsBulk).mockReset().mockResolvedValue([])
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('arranca preguntando de que billetera son los movimientos y que dia', () => {
    const wrapper = mount(BulkCaptureWizard)

    expect(wrapper.text()).toContain('¿De qué billetera son?')
    expect(wrapper.text()).toContain('BDV')
    expect(wrapper.text()).toContain('Ayer')
    expect(wrapper.findAll('.wizard-progress-segment.filled')).toHaveLength(1)
  })

  it('recorre los pasos: billetera, captura, revision y confirmacion', async () => {
    const wrapper = mount(BulkCaptureWizard, { props: { initialWalletId: BS.id } })

    await continueButton(wrapper).trigger('click')
    expect(wrapper.text()).toContain('Sube tus capturas')
    expect(wrapper.text()).toContain('historial de órdenes P2P de')
    expect(continueButton(wrapper).attributes('disabled')).toBeDefined()

    await pickImage(wrapper)
    expect(wrapper.text()).toContain('Lista de movimientos del banco · 5 movimientos')
    expect(continueButton(wrapper).attributes('disabled')).toBeUndefined()

    await continueButton(wrapper).trigger('click')
    expect(wrapper.text()).toContain('Revisa los movimientos')
    expect(wrapper.findAll('.row-card')).toHaveLength(5)
    // Faltan las categorias de los gastos: no se puede continuar.
    expect(wrapper.text()).toContain('Falta la categoría')
    expect(continueButton(wrapper).attributes('disabled')).toBeDefined()
  })

  it('se puede volver atras y la barra de progreso lo refleja', async () => {
    const wrapper = mount(BulkCaptureWizard, { props: { initialWalletId: BS.id } })
    await continueButton(wrapper).trigger('click')
    expect(wrapper.findAll('.wizard-progress-segment.filled')).toHaveLength(2)

    await wrapper.find('.wizard-back').trigger('click')

    expect(wrapper.text()).toContain('¿De qué billetera son?')
    expect(wrapper.findAll('.wizard-progress-segment.filled')).toHaveLength(1)
  })

  it('el primer paso no tiene boton de atras (se sale con el de la cabecera de la vista)', () => {
    const wrapper = mount(BulkCaptureWizard)

    expect(wrapper.find('.wizard-back').exists()).toBe(false)
  })

  it('al dejar todo omitido o pendiente se puede confirmar y avisa al terminar', async () => {
    const wrapper = mount(BulkCaptureWizard, { props: { initialWalletId: BS.id } })
    await continueButton(wrapper).trigger('click')
    await pickImage(wrapper)
    await continueButton(wrapper).trigger('click')

    // Cada fila como pendiente: no exige categoria.
    for (const card of wrapper.findAll('.row-card')) {
      const chip = card.findAll('.action-chip').find((item) => item.text() === 'Pendiente')!
      await chip.trigger('click')
    }
    expect(continueButton(wrapper).attributes('disabled')).toBeUndefined()

    await continueButton(wrapper).trigger('click')
    expect(wrapper.text()).toContain('Confirma el registro')
    expect(wrapper.text()).toContain('5 pendientes')

    await continueButton(wrapper).trigger('click')
    await flushPromises()

    expect(createDraftsBulk).toHaveBeenCalledTimes(1)
    expect(wrapper.emitted('done')?.[0]?.[0]).toMatchObject({ pendings: 5, failures: [] })
  })
})
