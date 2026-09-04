import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '../../../stores/auth.store'
import {
  TransactionsApiError,
  confirmDraft,
  createTransaction,
  deleteTransaction,
  discardDraft,
  listDrafts,
  listTransactions,
  updateTransaction,
} from '../transactions.service'

function mockResponse(body: unknown, init: { ok?: boolean; status?: number } = {}): Response {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    json: async () => body,
  } as unknown as Response
}

const TRANSACTION_WIRE = {
  id: 'tx-1',
  wallet_id: 'wallet-1',
  type: 'expense',
  amount: '25.99',
  category: 'comida',
  description: 'Almuerzo',
  occurred_at: '2026-08-01T12:00:00Z',
  source: 'manual',
  transfer_id: null,
  reference_amount_usd: null,
  created_at: '2026-08-01T12:00:01Z',
}

const TRANSACTION_MAPPED = {
  id: 'tx-1',
  walletId: 'wallet-1',
  type: 'expense',
  amount: 25.99,
  category: 'comida',
  description: 'Almuerzo',
  occurredAt: '2026-08-01T12:00:00Z',
  source: 'manual',
  transferId: null,
  referenceAmountUsd: null,
  createdAt: '2026-08-01T12:00:01Z',
}

const DRAFT_WIRE = {
  id: 'draft-1',
  source: 'voice',
  raw_input: 'gaste veinte dolares en comida',
  parsed_amount: '20',
  parsed_currency: 'USD',
  parsed_category: 'comida',
  parsed_description: null,
  status: 'pending',
  created_at: '2026-08-01T12:00:00Z',
}

const DRAFT_MAPPED = {
  id: 'draft-1',
  source: 'voice',
  rawInput: 'gaste veinte dolares en comida',
  parsedAmount: 20,
  parsedCurrency: 'USD',
  parsedCategory: 'comida',
  parsedDescription: null,
  status: 'pending',
  createdAt: '2026-08-01T12:00:00Z',
}

describe('transactions.service', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    useAuthStore().token = 'jwt-token'
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('createTransaction', () => {
    it('manda los campos requeridos en snake_case, sin los opcionales si no se dan', async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse(TRANSACTION_WIRE, { status: 201 }))

      await createTransaction({ walletId: 'wallet-1', type: 'expense', amount: 25.99, category: 'comida' })

      const [url, init] = vi.mocked(fetch).mock.calls[0]
      expect(url).toBe('/api/transactions')
      expect(init!.method).toBe('POST')
      expect(init!.headers).toEqual({ 'Content-Type': 'application/json', Authorization: 'Bearer jwt-token' })
      expect(JSON.parse(init!.body as string)).toEqual({
        wallet_id: 'wallet-1',
        type: 'expense',
        amount: 25.99,
        category: 'comida',
      })
    })

    it('incluye description/occurred_at/source cuando se dan', async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse(TRANSACTION_WIRE, { status: 201 }))

      await createTransaction({
        walletId: 'wallet-1',
        type: 'expense',
        amount: 25.99,
        category: 'comida',
        description: 'Almuerzo',
        occurredAt: '2026-08-01T12:00:00Z',
        source: 'manual',
      })

      const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string)
      expect(body).toEqual({
        wallet_id: 'wallet-1',
        type: 'expense',
        amount: 25.99,
        category: 'comida',
        description: 'Almuerzo',
        occurred_at: '2026-08-01T12:00:00Z',
        source: 'manual',
      })
    })

    it('mapea la respuesta a camelCase', async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse(TRANSACTION_WIRE, { status: 201 }))

      const result = await createTransaction({ walletId: 'wallet-1', type: 'expense', amount: 25.99, category: 'comida' })

      expect(result).toEqual(TRANSACTION_MAPPED)
    })

    // reference_amount_usd es un Decimal de Pydantic (number o string segun
    // serializacion) - mismo bug real de esta sesion que "amount"/"parsed_amount": sin
    // Number(...), un string tipo "12.04" queda como string en vez de number, y
    // undefined (wire sin el campo) se pasaba como NaN en vez de null.
    it('convierte reference_amount_usd de string a number cuando la wallet no esta en USD', async () => {
      vi.mocked(fetch).mockResolvedValue(
        mockResponse({ ...TRANSACTION_WIRE, reference_amount_usd: '12.04' }, { status: 201 }),
      )

      const result = await createTransaction({ walletId: 'wallet-1', type: 'expense', amount: 4082, category: 'Mercado' })

      expect(result.referenceAmountUsd).toBe(12.04)
    })

    it('lanza TransactionsApiError en 400 de validacion', async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse({ detail: 'Monto invalido.' }, { ok: false, status: 400 }))

      const error: unknown = await createTransaction({
        walletId: 'wallet-1',
        type: 'expense',
        amount: -1,
        category: 'comida',
      }).catch((e: unknown) => e)

      expect(error).toBeInstanceOf(TransactionsApiError)
      expect((error as TransactionsApiError).status).toBe(400)
    })
  })

  // Pedido explicito del usuario: "se debe poder editar los movimientos... montos,
  // fecha de pago, description, wallet_id, category todo lo necesario".
  describe('updateTransaction', () => {
    it('manda PATCH con todos los campos en snake_case, description null si no se da', async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse(TRANSACTION_WIRE))

      await updateTransaction('tx-1', {
        walletId: 'wallet-1',
        type: 'expense',
        amount: 45,
        category: 'Transporte',
        occurredAt: '2026-01-15T12:00:00Z',
      })

      const [url, init] = vi.mocked(fetch).mock.calls[0]
      expect(url).toBe('/api/transactions/tx-1')
      expect(init!.method).toBe('PATCH')
      expect(init!.headers).toEqual({ 'Content-Type': 'application/json', Authorization: 'Bearer jwt-token' })
      expect(JSON.parse(init!.body as string)).toEqual({
        wallet_id: 'wallet-1',
        type: 'expense',
        amount: 45,
        category: 'Transporte',
        description: null,
        occurred_at: '2026-01-15T12:00:00Z',
      })
    })

    it('incluye description cuando se da', async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse(TRANSACTION_WIRE))

      await updateTransaction('tx-1', {
        walletId: 'wallet-1',
        type: 'expense',
        amount: 45,
        category: 'Transporte',
        description: 'Taxi',
        occurredAt: '2026-01-15T12:00:00Z',
      })

      const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string)
      expect(body.description).toBe('Taxi')
    })

    it('mapea la respuesta a camelCase', async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse(TRANSACTION_WIRE))

      const result = await updateTransaction('tx-1', {
        walletId: 'wallet-1',
        type: 'expense',
        amount: 45,
        category: 'Transporte',
        occurredAt: '2026-01-15T12:00:00Z',
      })

      expect(result).toEqual(TRANSACTION_MAPPED)
    })

    it('lanza TransactionsApiError en 400 (ej. intentar editar una pata de transferencia)', async () => {
      vi.mocked(fetch).mockResolvedValue(
        mockResponse({ detail: 'No se puede editar una transferencia' }, { ok: false, status: 400 }),
      )

      const error: unknown = await updateTransaction('tx-1', {
        walletId: 'wallet-1',
        type: 'expense',
        amount: 45,
        category: 'Transporte',
        occurredAt: '2026-01-15T12:00:00Z',
      }).catch((e: unknown) => e)

      expect(error).toBeInstanceOf(TransactionsApiError)
      expect((error as TransactionsApiError).status).toBe(400)
    })
  })

  describe('listTransactions', () => {
    it('pide GET /api/transactions sin query string cuando no hay filtros', async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse([TRANSACTION_WIRE]))

      await listTransactions()

      const [url] = vi.mocked(fetch).mock.calls[0]
      expect(url).toBe('/api/transactions')
    })

    it('arma la query string con los filtros dados', async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse([TRANSACTION_WIRE]))

      await listTransactions({
        walletId: 'wallet-1',
        category: 'comida',
        dateFrom: '2026-08-01T00:00:00Z',
        dateTo: '2026-08-31T00:00:00Z',
      })

      const [url] = vi.mocked(fetch).mock.calls[0]
      expect(url).toBe(
        '/api/transactions?wallet_id=wallet-1&category=comida&date_from=2026-08-01T00%3A00%3A00Z&date_to=2026-08-31T00%3A00%3A00Z',
      )
    })

    it('mapea la lista completa a camelCase', async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse([TRANSACTION_WIRE]))

      const result = await listTransactions()

      expect(result).toEqual([TRANSACTION_MAPPED])
    })
  })

  describe('deleteTransaction', () => {
    it('pide DELETE /api/transactions/{id}', async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse(null, { status: 204 }))

      await deleteTransaction('tx-1')

      const [url, init] = vi.mocked(fetch).mock.calls[0]
      expect(url).toBe('/api/transactions/tx-1')
      expect(init!.method).toBe('DELETE')
    })

    it('lanza TransactionsApiError en 404', async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse({ detail: 'No encontrada.' }, { ok: false, status: 404 }))

      const error: unknown = await deleteTransaction('tx-x').catch((e: unknown) => e)

      expect(error).toBeInstanceOf(TransactionsApiError)
      expect((error as TransactionsApiError).status).toBe(404)
    })
  })

  describe('listDrafts', () => {
    it('pide GET /api/transactions/drafts?status=pending por default', async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse([DRAFT_WIRE]))

      const result = await listDrafts()

      const [url] = vi.mocked(fetch).mock.calls[0]
      expect(url).toBe('/api/transactions/drafts?status=pending')
      expect(result).toEqual([DRAFT_MAPPED])
    })

    it('devuelve lista vacia mapeada cuando no hay drafts pendientes', async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse([]))

      const result = await listDrafts()

      expect(result).toEqual([])
    })

    it('mapea parsed_amount null sin convertirlo a NaN', async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse([{ ...DRAFT_WIRE, parsed_amount: null }]))

      const result = await listDrafts()

      expect(result[0].parsedAmount).toBeNull()
    })
  })

  describe('confirmDraft', () => {
    it('manda los campos final_* en snake_case', async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse(TRANSACTION_WIRE))

      await confirmDraft('draft-1', { walletId: 'wallet-1', type: 'expense', finalAmount: 20, finalCategory: 'comida' })

      const [url, init] = vi.mocked(fetch).mock.calls[0]
      expect(url).toBe('/api/transactions/drafts/draft-1/confirm')
      expect(JSON.parse(init!.body as string)).toEqual({
        wallet_id: 'wallet-1',
        type: 'expense',
        final_amount: 20,
        final_category: 'comida',
      })
    })

    it('devuelve la transaction creada mapeada a camelCase', async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse(TRANSACTION_WIRE))

      const result = await confirmDraft('draft-1', {
        walletId: 'wallet-1',
        type: 'expense',
        finalAmount: 20,
        finalCategory: 'comida',
      })

      expect(result).toEqual(TRANSACTION_MAPPED)
    })

    it('lanza TransactionsApiError en 404 (draft no existe o no es tuyo)', async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse({ detail: 'No encontrado.' }, { ok: false, status: 404 }))

      const error: unknown = await confirmDraft('draft-x', {
        walletId: 'wallet-1',
        type: 'expense',
        finalAmount: 20,
        finalCategory: 'comida',
      }).catch((e: unknown) => e)

      expect(error).toBeInstanceOf(TransactionsApiError)
      expect((error as TransactionsApiError).status).toBe(404)
    })
  })

  describe('discardDraft', () => {
    it('pide POST /api/transactions/drafts/{id}/discard y mapea el draft actualizado', async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse({ ...DRAFT_WIRE, status: 'discarded' }))

      const result = await discardDraft('draft-1')

      const [url, init] = vi.mocked(fetch).mock.calls[0]
      expect(url).toBe('/api/transactions/drafts/draft-1/discard')
      expect(init!.method).toBe('POST')
      expect(result.status).toBe('discarded')
    })
  })
})
