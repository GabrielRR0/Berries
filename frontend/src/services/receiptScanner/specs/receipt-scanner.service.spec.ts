import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '../../../stores/auth.store'
import { ReceiptScannerApiError, submitReceiptScan } from '../receipt-scanner.service'

function mockResponse(body: unknown, init: { ok?: boolean; status?: number } = {}): Response {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    json: async () => body,
  } as unknown as Response
}

const DRAFT_WIRE = {
  id: 'draft-2',
  source: 'ocr',
  raw_input: null,
  parsed_amount: '15.50',
  parsed_currency: 'USD',
  parsed_category: 'supermercado',
  parsed_description: null,
  status: 'pending',
  created_at: '2026-08-01T12:00:00Z',
}

const DRAFT_MAPPED = {
  id: 'draft-2',
  source: 'ocr',
  rawInput: null,
  parsedAmount: 15.5,
  parsedCurrency: 'USD',
  parsedCategory: 'supermercado',
  parsedDescription: null,
  status: 'pending',
  createdAt: '2026-08-01T12:00:00Z',
}

describe('receipt-scanner.service', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    useAuthStore().token = 'jwt-token'
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('submitReceiptScan', () => {
    it('manda la imagen como FormData con field "image" y Authorization, sin Content-Type manual', async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse(DRAFT_WIRE, { status: 201 }))
      const file = new File(['fake-image-bytes'], 'recibo.jpg', { type: 'image/jpeg' })

      await submitReceiptScan(file)

      const [url, init] = vi.mocked(fetch).mock.calls[0]
      expect(url).toBe('/api/receipt-scanner')
      expect(init!.method).toBe('POST')
      expect(init!.headers).toEqual({ Authorization: 'Bearer jwt-token' })
      expect(init!.body).toBeInstanceOf(FormData)

      const formData = init!.body as FormData
      const imageEntry = formData.get('image') as File
      expect(imageEntry).toBeInstanceOf(File)
      expect(imageEntry.name).toBe('recibo.jpg')
      expect(init!.headers).not.toHaveProperty('Content-Type')
    })

    it('mapea la respuesta del backend (snake_case) a un Draft en camelCase con source "ocr"', async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse(DRAFT_WIRE, { status: 201 }))
      const file = new File(['fake-image-bytes'], 'recibo.jpg', { type: 'image/jpeg' })

      const result = await submitReceiptScan(file)

      expect(result).toEqual(DRAFT_MAPPED)
    })

    it('lanza ReceiptScannerApiError con el detail y el status 503 cuando el OCR no esta configurado (caso real hoy)', async () => {
      vi.mocked(fetch).mockResolvedValue(
        mockResponse({ detail: 'El servicio de escaneo de recibos no está disponible.' }, { ok: false, status: 503 }),
      )
      const file = new File(['x'], 'recibo.jpg', { type: 'image/jpeg' })

      const error: unknown = await submitReceiptScan(file).catch((e: unknown) => e)

      expect(error).toBeInstanceOf(ReceiptScannerApiError)
      expect((error as ReceiptScannerApiError).status).toBe(503)
      expect((error as ReceiptScannerApiError).message).toBe('El servicio de escaneo de recibos no está disponible.')
    })

    it('usa un mensaje de fallback en espanol si la respuesta de error no trae detail', async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse(null, { ok: false, status: 503 }))
      const file = new File(['x'], 'recibo.jpg', { type: 'image/jpeg' })

      const error: unknown = await submitReceiptScan(file).catch((e: unknown) => e)

      expect((error as ReceiptScannerApiError).message).toBe('El escaneo de recibos todavía no está disponible.')
    })
  })
})
