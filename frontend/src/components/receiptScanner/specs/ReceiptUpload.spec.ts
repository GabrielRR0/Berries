import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ReceiptScannerApiError, submitReceiptScan } from '../../../services/receiptScanner/receipt-scanner.service'
import ReceiptUpload from '../ReceiptUpload.vue'

vi.mock('../../../services/receiptScanner/receipt-scanner.service', async () => {
  const actual = await vi.importActual<typeof import('../../../services/receiptScanner/receipt-scanner.service')>(
    '../../../services/receiptScanner/receipt-scanner.service',
  )
  return { ...actual, submitReceiptScan: vi.fn() }
})

function selectFile(wrapper: VueWrapper, file: File) {
  const input = wrapper.find('input[type="file"]')
  Object.defineProperty(input.element, 'files', { value: [file], configurable: true })
  return input.trigger('change')
}

const DRAFT = {
  id: 'draft-2',
  source: 'ocr',
  rawInput: null,
  parsedAmount: 15.5,
  parsedCurrency: 'USD',
  parsedCategory: 'supermercado',
  parsedDescription: null,
  suggestedWalletId: null,
  status: 'pending',
  createdAt: '2026-08-01T12:00:00Z',
}

describe('ReceiptUpload', () => {
  beforeEach(() => {
    vi.mocked(submitReceiptScan).mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('arranca sin mensajes de error ni estado de carga', () => {
    const wrapper = mount(ReceiptUpload)

    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(wrapper.find('.upload-status').exists()).toBe(false)
  })

  it('sube el archivo elegido apenas se selecciona y emite "created" con el draft en exito', async () => {
    vi.mocked(submitReceiptScan).mockResolvedValue(DRAFT)
    const wrapper = mount(ReceiptUpload)
    const file = new File(['fake-bytes'], 'recibo.jpg', { type: 'image/jpeg' })

    await selectFile(wrapper, file)
    await flushPromises()

    expect(submitReceiptScan).toHaveBeenCalledWith(file)
    expect(wrapper.emitted('created')).toBeTruthy()
    expect(wrapper.emitted('created')![0]).toEqual([DRAFT])
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
  })

  it('muestra el mensaje del backend cuando el escaner de recibos responde 503 (todavia no configurado), sin crashear', async () => {
    vi.mocked(submitReceiptScan).mockRejectedValue(
      new ReceiptScannerApiError('El escaneo de recibos todavía no está disponible.', 503),
    )
    const wrapper = mount(ReceiptUpload)
    const file = new File(['fake-bytes'], 'recibo.jpg', { type: 'image/jpeg' })

    await selectFile(wrapper, file)
    await flushPromises()

    expect(wrapper.find('[role="alert"]').text()).toBe('El escaneo de recibos todavía no está disponible.')
    expect(wrapper.emitted('created')).toBeFalsy()
  })
})
