import { createPinia, setActivePinia } from 'pinia'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { recognizeScreenshot } from '../../../services/screenshotScan/screenshot-scan.service'
import { checkDuplicates, createDraftsBulk, createTransactionsBulk } from '../../../services/transactions/transactions.service'
import { useTransactionsStore } from '../../../stores/transactions.store'
import { useWalletsStore } from '../../../stores/wallets.store'
import { BANK_WORDS, isGreen, layoutOf } from '../../../utils/screenshotScan/specs/listFixtures'
import BulkCaptureWizard from '../BulkCaptureWizard.vue'

vi.mock('../../../services/screenshotScan/screenshot-scan.service', () => ({ recognizeScreenshot: vi.fn() }))
vi.mock('../../../services/transactions/transactions.service', () => ({
  createTransactionsBulk: vi.fn(),
  createDraftsBulk: vi.fn(),
  checkDuplicates: vi.fn(),
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

type Wrapper = ReturnType<typeof mount>

async function pickImage(wrapper: Wrapper) {
  const input = wrapper.find('input[type="file"]')
  Object.defineProperty(input.element, 'files', {
    value: [new File(['x'], 'captura.png', { type: 'image/png' })],
    configurable: true,
  })
  await input.trigger('change')
  // La lectura espera la consulta de duplicados (usa crypto.subtle, asincrono de verdad), asi
  // que se espera a que termine en vez de un solo flushPromises.
  await vi.waitFor(() => expect(wrapper.text()).not.toContain('Leyendo la captura...'))
  await flushPromises()
}

function continueButton(wrapper: Wrapper) {
  return wrapper.find('.wizard-next')
}

// Textos que identifican cada paso (el titulo de la pregunta).
const TITLE = {
  wallet: '¿De qué billetera son?',
  kind: '¿Qué quieres registrar?',
  details: 'Fecha y comisiones',
  expenseCategory: 'Categoría de los gastos',
  incomeCategory: 'Categoría de los ingresos',
  captures: 'Sube tus capturas',
  review: 'Revisa los movimientos',
  confirm: 'Confirma el registro',
}

// Avanza con "Continuar" hasta llegar a un paso (un limite evita un bucle si nunca llega).
async function goTo(wrapper: Wrapper, title: string) {
  for (let attempt = 0; attempt < 10 && !wrapper.text().includes(title); attempt++) {
    await continueButton(wrapper).trigger('click')
  }
  expect(wrapper.text()).toContain(title)
}

function pill(wrapper: Wrapper, label: string) {
  return wrapper.findAll('.pill').find((item) => item.text() === label)!
}

function titlesInOrder(wrapper: Wrapper): string[] {
  return wrapper.findAll('.wizard-title').map((node) => node.text())
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
    vi.mocked(checkDuplicates).mockReset().mockResolvedValue(new Set())
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('un paso por pregunta', () => {
    it('cada paso muestra una sola cosa: el primero solo la billetera', () => {
      const wrapper = mount(BulkCaptureWizard)

      expect(titlesInOrder(wrapper)).toEqual([TITLE.wallet])
      expect(wrapper.text()).toContain('BDV')
      expect(wrapper.text()).not.toContain(TITLE.kind)
      expect(wrapper.text()).not.toContain('¿De qué día?')
      expect(wrapper.text()).not.toContain('Tomar en cuenta las comisiones')
      expect(wrapper.text()).not.toContain('Categoría')
    })

    it('recorre un paso a la vez: billetera, que registrar, fecha y comisiones, categorias y capturas', async () => {
      const wrapper = mount(BulkCaptureWizard)

      for (const key of ['wallet', 'kind', 'details', 'expenseCategory', 'incomeCategory', 'captures'] as const) {
        expect(titlesInOrder(wrapper)).toEqual([TITLE[key]])
        if (key !== 'captures') await continueButton(wrapper).trigger('click')
      }
    })

    it('el paso de fecha y comisiones tiene solo esas dos cosas', async () => {
      const wrapper = mount(BulkCaptureWizard)
      await goTo(wrapper, TITLE.details)

      expect(wrapper.text()).toContain('¿De qué día?')
      expect(wrapper.text()).toContain('Hoy')
      expect(wrapper.text()).toContain('Ayer')
      expect(wrapper.text()).toContain('Tomar en cuenta las comisiones')
      expect(wrapper.text()).not.toContain('Solo gastos')
      expect(wrapper.text()).not.toContain('Categoría')
    })

    it('la barra de progreso tiene un segmento por paso y avanza', async () => {
      const wrapper = mount(BulkCaptureWizard)

      // billetera, que registrar, fecha, categoria de gastos, de ingresos, capturas, revision y confirmacion
      expect(wrapper.findAll('.wizard-progress-segment')).toHaveLength(8)
      expect(wrapper.findAll('.wizard-progress-segment.filled')).toHaveLength(1)

      await continueButton(wrapper).trigger('click')
      expect(wrapper.findAll('.wizard-progress-segment.filled')).toHaveLength(2)
    })

    it('se puede volver atras y la barra lo refleja', async () => {
      const wrapper = mount(BulkCaptureWizard)
      await goTo(wrapper, TITLE.details)
      expect(wrapper.findAll('.wizard-progress-segment.filled')).toHaveLength(3)

      await wrapper.find('.wizard-back').trigger('click')

      expect(titlesInOrder(wrapper)).toEqual([TITLE.kind])
      expect(wrapper.findAll('.wizard-progress-segment.filled')).toHaveLength(2)
    })

    it('el primer paso no tiene boton de atras (se sale con el de la cabecera de la vista)', () => {
      const wrapper = mount(BulkCaptureWizard)

      expect(wrapper.find('.wizard-back').exists()).toBe(false)
    })
  })

  describe('pasos que se saltan solos', () => {
    it('si se llego desde una billetera no se pregunta cual', async () => {
      const wrapper = mount(BulkCaptureWizard, { props: { initialWalletId: BS.id } })

      expect(titlesInOrder(wrapper)).toEqual([TITLE.kind])
      expect(wrapper.find('.wizard-back').exists()).toBe(false)
      expect(wrapper.findAll('.wizard-progress-segment')).toHaveLength(7)
    })

    it('con "Solo gastos" no se pide la categoria de los ingresos', async () => {
      const wrapper = mount(BulkCaptureWizard, { props: { initialWalletId: BS.id } })
      await pill(wrapper, 'Solo gastos').trigger('click')

      await goTo(wrapper, TITLE.expenseCategory)
      await continueButton(wrapper).trigger('click')

      expect(titlesInOrder(wrapper)).toEqual([TITLE.captures])
      expect(wrapper.text()).not.toContain(TITLE.incomeCategory)
    })

    it('con "Solo ingresos" no se pide la categoria de los gastos', async () => {
      const wrapper = mount(BulkCaptureWizard, { props: { initialWalletId: BS.id } })
      await pill(wrapper, 'Solo ingresos').trigger('click')

      await goTo(wrapper, TITLE.details)
      await continueButton(wrapper).trigger('click')

      expect(titlesInOrder(wrapper)).toEqual([TITLE.incomeCategory])
    })

    it('con "Transferencias" no se piden categorias: de fecha y comisiones se pasa a las capturas', async () => {
      const wrapper = mount(BulkCaptureWizard, { props: { initialWalletId: BS.id } })
      await pill(wrapper, 'Transferencias').trigger('click')
      // kind, details, captures, review, confirm
      expect(wrapper.findAll('.wizard-progress-segment')).toHaveLength(5)

      await goTo(wrapper, TITLE.details)
      await continueButton(wrapper).trigger('click')

      expect(titlesInOrder(wrapper)).toEqual([TITLE.captures])
    })
  })

  describe('paso: billetera', () => {
    it('con una sola billetera en bolivares la elige sola y lo dice', () => {
      const wrapper = mount(BulkCaptureWizard)

      expect(wrapper.text()).toContain('Elegimos la única billetera posible')
      expect(wrapper.find('.wallet-tile.active').text()).toContain('BDV')
    })

    it('con dos billeteras en bolivares no elige ninguna', () => {
      useWalletsStore().wallets = [BS, { ...BS, id: 'w-bs2', name: 'Banesco' }]
      const wrapper = mount(BulkCaptureWizard)

      expect(wrapper.find('.wallet-tile.active').exists()).toBe(false)
      expect(wrapper.text()).not.toContain('Elegimos la única billetera posible')
    })

    it('elegir una billetera a mano la marca y quita el aviso de seleccion automatica', async () => {
      const wrapper = mount(BulkCaptureWizard)

      await wrapper.findAll('.wallet-tile').find((tile) => tile.text().includes('Efectivo'))!.trigger('click')

      expect(wrapper.find('.wallet-tile.active').text()).toContain('Efectivo')
      expect(wrapper.text()).not.toContain('Elegimos la única billetera posible')
    })
  })

  describe('paso: que registrar', () => {
    it('ofrece las cuatro opciones con su explicacion', async () => {
      const wrapper = mount(BulkCaptureWizard, { props: { initialWalletId: BS.id } })

      for (const label of ['Todo', 'Solo gastos', 'Solo ingresos', 'Transferencias']) {
        expect(pill(wrapper, label).exists()).toBe(true)
      }
      expect(wrapper.text()).toContain('se detecta solo qué es cada movimiento')

      await pill(wrapper, 'Solo gastos').trigger('click')
      expect(wrapper.text()).toContain('ni las transferencias (como las órdenes P2P)')

      await pill(wrapper, 'Solo ingresos').trigger('click')
      expect(wrapper.text()).toContain('ni las transferencias (como las órdenes P2P)')

      await pill(wrapper, 'Transferencias').trigger('click')
      expect(wrapper.text()).toContain('No es un gasto ni un ingreso')
    })

    it('el tipo de transferencia solo se pregunta al elegir "Transferencias"', async () => {
      const wrapper = mount(BulkCaptureWizard, { props: { initialWalletId: BS.id } })
      expect(wrapper.text()).not.toContain('¿Qué tipo de transferencia?')

      await pill(wrapper, 'Solo gastos').trigger('click')
      expect(wrapper.text()).not.toContain('¿Qué tipo de transferencia?')

      await pill(wrapper, 'Transferencias').trigger('click')
      expect(wrapper.text()).toContain('¿Qué tipo de transferencia?')
      expect(wrapper.text()).toContain('P2P de Binance')
      expect(wrapper.text()).toContain('Otra transferencia')
    })

    it('P2P de Binance viene elegido y explica que se enlaza con las ordenes', async () => {
      const wrapper = mount(BulkCaptureWizard, { props: { initialWalletId: BS.id } })

      await pill(wrapper, 'Transferencias').trigger('click')

      expect(wrapper.text()).toContain('quedan pendientes de enlazar con su orden')
    })

    it('"Otra transferencia" explica el caso de dolares dados a un amigo que los cambia a USDT', async () => {
      const wrapper = mount(BulkCaptureWizard, { props: { initialWalletId: BS.id } })
      await pill(wrapper, 'Transferencias').trigger('click')

      await pill(wrapper, 'Otra transferencia').trigger('click')

      expect(wrapper.text()).toContain('le diste dólares de Facebank a un amigo que te los cambió a USDT')
      expect(wrapper.text()).not.toContain('quedan pendientes de enlazar con su orden')
    })
  })

  describe('pasos: categorias', () => {
    it('el boton avisa que se puede seguir sin categoria y cambia al elegir una', async () => {
      const wrapper = mount(BulkCaptureWizard)
      await goTo(wrapper, TITLE.expenseCategory)

      expect(continueButton(wrapper).text()).toBe('Continuar sin categoría')

      await wrapper.find('input[type="text"]').setValue('Mercado')
      expect(continueButton(wrapper).text()).toBe('Continuar')
    })

    it('la categoria elegida llega a los gastos leidos', async () => {
      const wrapper = mount(BulkCaptureWizard, { props: { initialWalletId: BS.id } })
      await pill(wrapper, 'Solo gastos').trigger('click')
      await goTo(wrapper, TITLE.expenseCategory)
      await wrapper.find('input[type="text"]').setValue('Mercado')
      await goTo(wrapper, TITLE.captures)

      await pickImage(wrapper)
      await continueButton(wrapper).trigger('click')

      expect(wrapper.text()).toContain(TITLE.review)
      expect(wrapper.text()).not.toContain('Falta la categoría')
      expect(continueButton(wrapper).attributes('disabled')).toBeUndefined()
    })
  })

  describe('capturas, revision y confirmacion', () => {
    it('recorre los pasos hasta la revision y exige completar lo que falta', async () => {
      const wrapper = mount(BulkCaptureWizard, { props: { initialWalletId: BS.id } })

      await goTo(wrapper, TITLE.captures)
      expect(wrapper.text()).toContain('historial de órdenes P2P de')
      expect(continueButton(wrapper).attributes('disabled')).toBeDefined()

      await pickImage(wrapper)
      expect(wrapper.text()).toContain('Lista de movimientos del banco · 5 movimientos')
      expect(continueButton(wrapper).attributes('disabled')).toBeUndefined()

      await continueButton(wrapper).trigger('click')
      expect(wrapper.text()).toContain(TITLE.review)
      expect(wrapper.findAll('.row-card')).toHaveLength(5)
      // Sin categoria elegida antes, faltan las de los gastos: no se puede continuar.
      expect(wrapper.text()).toContain('Falta la categoría')
      expect(continueButton(wrapper).attributes('disabled')).toBeDefined()
    })

    it('al dejar todo pendiente se puede confirmar y avisa al terminar', async () => {
      const wrapper = mount(BulkCaptureWizard, { props: { initialWalletId: BS.id } })
      await goTo(wrapper, TITLE.captures)
      await pickImage(wrapper)
      await continueButton(wrapper).trigger('click')

      // Cada fila como pendiente: no exige categoria.
      for (const card of wrapper.findAll('.row-card')) {
        const chip = card.findAll('.action-chip').find((item) => item.text() === 'Pendiente')!
        await chip.trigger('click')
      }
      expect(continueButton(wrapper).attributes('disabled')).toBeUndefined()

      await continueButton(wrapper).trigger('click')
      expect(wrapper.text()).toContain(TITLE.confirm)
      expect(wrapper.text()).toContain('5 pendientes')

      await continueButton(wrapper).trigger('click')
      await flushPromises()

      expect(createDraftsBulk).toHaveBeenCalledTimes(1)
      expect(wrapper.emitted('done')?.[0]?.[0]).toMatchObject({ pendings: 5, failures: [] })
    })
  })
})
