import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '../../../stores/auth.store'
import {
  confirmDraftAsTransfer,
  createDraftsBulk,
  createTransactionsBulk,
  TransactionsApiError,
  updateDraft,
} from '../transactions.service'

function mockResponse(body: unknown, init: { ok?: boolean; status?: number } = {}): Response {
  return { ok: init.ok ?? true, status: init.status ?? 200, json: async () => body } as unknown as Response
}

const DRAFT_WIRE = {
  id: 'draft-1',
  source: 'screenshot',
  raw_input: null,
  parsed_amount: '26600.00',
  parsed_currency: 'VEF',
  parsed_category: null,
  parsed_description: 'Abono recibido otr bcos',
  suggested_wallet_id: 'w-bs',
  txn_type: 'income',
  occurred_at: '2026-10-08T21:58:00Z',
  fee: '0.50',
  reference: '007608296806',
  status: 'pending',
  created_at: '2026-10-09T10:00:00Z',
}

describe('transactions.service - registro desde capturas', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    setActivePinia(createPinia())
    useAuthStore().token = 'jwt-token'
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('createTransactionsBulk manda todos los movimientos en una sola llamada, con source "screenshot"', async () => {
    fetchMock.mockResolvedValue(mockResponse([]))

    await createTransactionsBulk([
      { walletId: 'w-bs', type: 'expense', amount: 22848, category: 'Mercado', occurredAt: '2026-10-08T22:25:00Z' },
      { walletId: 'w-bs', type: 'expense', amount: 68.54, category: 'Comisión', source: 'manual' },
    ])

    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toContain('/api/transactions/bulk')
    expect(init.method).toBe('POST')
    expect(init.headers.Authorization).toBe('Bearer jwt-token')
    const body = JSON.parse(init.body)
    expect(body.items).toHaveLength(2)
    expect(body.items[0]).toMatchObject({ wallet_id: 'w-bs', amount: 22848, category: 'Mercado', source: 'screenshot' })
    expect(body.items[1].source).toBe('manual')
  })

  it('createTransactionsBulk expone el detalle del error del backend', async () => {
    fetchMock.mockResolvedValue(mockResponse({ detail: 'Billetera no encontrada' }, { ok: false, status: 400 }))

    await expect(createTransactionsBulk([{ walletId: 'x', type: 'expense', amount: 1, category: 'a' }])).rejects.toMatchObject({
      name: 'TransactionsApiError',
      message: 'Billetera no encontrada',
      status: 400,
    })
    await expect(createTransactionsBulk([{ walletId: 'x', type: 'expense', amount: 1, category: 'a' }])).rejects.toBeInstanceOf(
      TransactionsApiError,
    )
  })

  it('createDraftsBulk guarda pendientes y mapea tipo, fecha, comision y referencia', async () => {
    fetchMock.mockResolvedValue(mockResponse([DRAFT_WIRE], { status: 201 }))

    const [draft] = await createDraftsBulk([
      {
        parsedAmount: 26600,
        parsedCurrency: 'VEF',
        suggestedWalletId: 'w-bs',
        txnType: 'income',
        occurredAt: '2026-10-08T21:58:00Z',
        reference: '007608296806',
      },
    ])

    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toContain('/api/transactions/drafts/bulk')
    expect(JSON.parse(init.body).items[0]).toMatchObject({
      source: 'screenshot',
      parsed_amount: 26600,
      suggested_wallet_id: 'w-bs',
      txn_type: 'income',
      occurred_at: '2026-10-08T21:58:00Z',
    })
    expect(draft).toMatchObject({
      txnType: 'income',
      occurredAt: '2026-10-08T21:58:00Z',
      fee: 0.5,
      reference: '007608296806',
      parsedAmount: 26600,
    })
  })

  it('updateDraft solo envia los campos que cambian', async () => {
    fetchMock.mockResolvedValue(mockResponse(DRAFT_WIRE))

    await updateDraft('draft-1', { parsedCategory: 'Otros ingresos' })

    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toContain('/api/transactions/drafts/draft-1')
    expect(init.method).toBe('PATCH')
    expect(JSON.parse(init.body)).toEqual({ parsed_category: 'Otros ingresos' })
  })

  it('confirmDraftAsTransfer manda origen, destino y lo que salio', async () => {
    fetchMock.mockResolvedValue(mockResponse({ ...DRAFT_WIRE, status: 'confirmed' }))

    const draft = await confirmDraftAsTransfer('draft-1', { fromWalletId: 'w-usdt', toWalletId: 'w-bs', sentAmount: 26.48, fee: 0.06 })

    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toContain('/api/transactions/drafts/draft-1/confirm-transfer')
    expect(JSON.parse(init.body)).toEqual({ from_wallet_id: 'w-usdt', to_wallet_id: 'w-bs', sent_amount: 26.48, fee: 0.06 })
    expect(draft.status).toBe('confirmed')
  })

  it('confirmDraftAsTransfer informa el error (por ejemplo saldo insuficiente)', async () => {
    fetchMock.mockResolvedValue(mockResponse({ detail: 'Saldo insuficiente para esta transferencia' }, { ok: false, status: 400 }))

    await expect(confirmDraftAsTransfer('draft-1', { fromWalletId: 'a', sentAmount: 1 })).rejects.toThrow(
      'Saldo insuficiente para esta transferencia',
    )
  })
})
