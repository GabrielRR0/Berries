import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  DebtsApiError,
  addDebtPayment,
  createDebt,
  deleteDebt,
  deleteDebtPayment,
  getDebtSummary,
  listDebts,
  parseDebtPaymentVoice,
  payInstallment,
  unpayInstallment,
} from '../debts.service'

function mockResponse(body: unknown, init: { ok?: boolean; status?: number } = {}): Response {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    json: async () => body,
  } as unknown as Response
}

const INSTALLMENT_WIRE = {
  id: 'inst-1',
  debt_id: 'debt-1',
  due_date: '2026-09-01',
  amount: 50,
  status: 'pending',
  paid_at: null,
}

const DEBT_PAYMENT_WIRE = {
  id: 'payment-1',
  debt_id: 'debt-1',
  amount: 50,
  currency: 'USD',
  applied_amount: 50,
  note: null,
  paid_at: '2026-08-30',
  wallet_id: null,
  created_at: '2026-08-30T00:00:00Z',
}

const DEBT_WIRE = {
  id: 'debt-1',
  user_id: 'user-1',
  counterparty_name: 'Juan Pérez',
  direction: 'owed_to_user',
  total_amount: 300,
  currency: 'USD',
  description: 'Préstamo',
  created_at: '2026-08-01T00:00:00Z',
  installments: [INSTALLMENT_WIRE],
  payments: [DEBT_PAYMENT_WIRE],
  amount_paid: 50,
  remaining_amount: 250,
}

describe('debts.service', () => {
  beforeEach(() => {
    localStorage.clear()
    localStorage.setItem('berry_auth_token', 'jwt-token')
    setActivePinia(createPinia())
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('createDebt', () => {
    it('manda los campos requeridos en snake_case y el token en Authorization', async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse(DEBT_WIRE, { status: 201 }))

      await createDebt({
        counterpartyName: 'Juan Pérez',
        direction: 'owed_to_user',
        totalAmount: 300,
        currency: 'USD',
      })

      const [url, init] = vi.mocked(fetch).mock.calls[0]
      expect(url).toBe('/api/debts')
      expect(init!.method).toBe('POST')
      expect(init!.headers).toEqual({ 'Content-Type': 'application/json', Authorization: 'Bearer jwt-token' })
      expect(JSON.parse(init!.body as string)).toEqual({
        counterparty_name: 'Juan Pérez',
        direction: 'owed_to_user',
        total_amount: 300,
        currency: 'USD',
      })
    })

    it('incluye los campos opcionales (description/installment_count/first_due_date/frequency_days) cuando se dan', async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse(DEBT_WIRE, { status: 201 }))

      await createDebt({
        counterpartyName: 'Juan Pérez',
        direction: 'owed_to_user',
        totalAmount: 300,
        currency: 'USD',
        description: 'Préstamo',
        installmentCount: 6,
        firstDueDate: '2026-09-01',
        frequencyDays: 30,
      })

      const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string)
      expect(body).toEqual({
        counterparty_name: 'Juan Pérez',
        direction: 'owed_to_user',
        total_amount: 300,
        currency: 'USD',
        description: 'Préstamo',
        installment_count: 6,
        first_due_date: '2026-09-01',
        frequency_days: 30,
      })
    })

    it('mapea la respuesta snake_case a camelCase, incluyendo installments', async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse(DEBT_WIRE, { status: 201 }))

      const result = await createDebt({
        counterpartyName: 'Juan Pérez',
        direction: 'owed_to_user',
        totalAmount: 300,
        currency: 'USD',
      })

      expect(result).toEqual({
        id: 'debt-1',
        userId: 'user-1',
        counterpartyName: 'Juan Pérez',
        direction: 'owed_to_user',
        totalAmount: 300,
        currency: 'USD',
        description: 'Préstamo',
        createdAt: '2026-08-01T00:00:00Z',
        installments: [
          {
            id: 'inst-1',
            debtId: 'debt-1',
            dueDate: '2026-09-01',
            amount: 50,
            status: 'pending',
            paidAt: null,
          },
        ],
        payments: [
          {
            id: 'payment-1',
            debtId: 'debt-1',
            amount: 50,
            currency: 'USD',
            appliedAmount: 50,
            note: null,
            paidAt: '2026-08-30',
            walletId: null,
            createdAt: '2026-08-30T00:00:00Z',
          },
        ],
        amountPaid: 50,
        remainingAmount: 250,
      })
    })

    it('lanza DebtsApiError con el status y el detail del backend en error', async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse({ detail: 'Monto inválido.' }, { ok: false, status: 422 }))

      const error: unknown = await createDebt({
        counterpartyName: 'Juan Pérez',
        direction: 'owed_to_user',
        totalAmount: -1,
        currency: 'USD',
      }).catch((e: unknown) => e)

      expect(error).toBeInstanceOf(DebtsApiError)
      expect((error as DebtsApiError).status).toBe(422)
      expect((error as DebtsApiError).message).toBe('Monto inválido.')
    })
  })

  describe('listDebts', () => {
    it('sin direction, no manda query param', async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse([DEBT_WIRE]))

      await listDebts()

      const [url, init] = vi.mocked(fetch).mock.calls[0]
      expect(url).toBe('/api/debts')
      expect(init!.headers).toEqual({ Authorization: 'Bearer jwt-token' })
    })

    it('con direction, la manda como query param', async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse([DEBT_WIRE]))

      await listDebts('owed_by_user')

      const [url] = vi.mocked(fetch).mock.calls[0]
      expect(url).toBe('/api/debts?direction=owed_by_user')
    })

    it('mapea la lista completa a camelCase', async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse([DEBT_WIRE]))

      const result = await listDebts()

      expect(result).toHaveLength(1)
      expect(result[0].counterpartyName).toBe('Juan Pérez')
      expect(result[0].installments[0].status).toBe('pending')
    })

    it('lanza DebtsApiError en error del servidor', async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse({ detail: 'Error interno.' }, { ok: false, status: 500 }))

      const error: unknown = await listDebts().catch((e: unknown) => e)

      expect(error).toBeInstanceOf(DebtsApiError)
      expect((error as DebtsApiError).status).toBe(500)
    })
  })

  describe('getDebtSummary', () => {
    it('pide el endpoint de resumen y mapea a camelCase', async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse({ total_owed_by_user: 100, total_owed_to_user: 250 }))

      const result = await getDebtSummary()

      const [url, init] = vi.mocked(fetch).mock.calls[0]
      expect(url).toBe('/api/debts/summary')
      expect(init!.headers).toEqual({ Authorization: 'Bearer jwt-token' })
      expect(result).toEqual({ totalOwedByUser: 100, totalOwedToUser: 250 })
    })
  })

  describe('deleteDebt', () => {
    it('manda DELETE al endpoint del id con el token', async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse(null, { status: 204 }))

      await deleteDebt('debt-1')

      const [url, init] = vi.mocked(fetch).mock.calls[0]
      expect(url).toBe('/api/debts/debt-1')
      expect(init!.method).toBe('DELETE')
      expect(init!.headers).toEqual({ Authorization: 'Bearer jwt-token' })
    })

    it('lanza DebtsApiError en 404', async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse({ detail: 'Deuda no encontrada.' }, { ok: false, status: 404 }))

      const error: unknown = await deleteDebt('missing').catch((e: unknown) => e)

      expect(error).toBeInstanceOf(DebtsApiError)
      expect((error as DebtsApiError).status).toBe(404)
    })
  })

  describe('payInstallment', () => {
    it('manda POST al endpoint de pay con el token', async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse(INSTALLMENT_WIRE))

      await payInstallment('debt-1', 'inst-1')

      const [url, init] = vi.mocked(fetch).mock.calls[0]
      expect(url).toBe('/api/debts/debt-1/installments/inst-1/pay')
      expect(init!.method).toBe('POST')
      expect(init!.headers).toEqual({ Authorization: 'Bearer jwt-token' })
    })

    it('lanza DebtsApiError en error', async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse({ detail: 'No se pudo pagar.' }, { ok: false, status: 400 }))

      const error: unknown = await payInstallment('debt-1', 'inst-1').catch((e: unknown) => e)

      expect(error).toBeInstanceOf(DebtsApiError)
    })
  })

  describe('unpayInstallment', () => {
    it('manda POST al endpoint de unpay con el token', async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse(INSTALLMENT_WIRE))

      await unpayInstallment('debt-1', 'inst-1')

      const [url, init] = vi.mocked(fetch).mock.calls[0]
      expect(url).toBe('/api/debts/debt-1/installments/inst-1/unpay')
      expect(init!.method).toBe('POST')
    })

    it('lanza DebtsApiError en error', async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse({ detail: 'No se pudo revertir.' }, { ok: false, status: 400 }))

      const error: unknown = await unpayInstallment('debt-1', 'inst-1').catch((e: unknown) => e)

      expect(error).toBeInstanceOf(DebtsApiError)
    })
  })

  describe('addDebtPayment', () => {
    it('manda los campos requeridos en snake_case', async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse(DEBT_PAYMENT_WIRE, { status: 201 }))

      await addDebtPayment('debt-1', { amount: 50, currency: 'USD' })

      const [url, init] = vi.mocked(fetch).mock.calls[0]
      expect(url).toBe('/api/debts/debt-1/payments')
      expect(init!.method).toBe('POST')
      expect(init!.headers).toEqual({ 'Content-Type': 'application/json', Authorization: 'Bearer jwt-token' })
      expect(JSON.parse(init!.body as string)).toEqual({ amount: 50, currency: 'USD' })
    })

    it('incluye los campos opcionales cuando se dan', async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse(DEBT_PAYMENT_WIRE, { status: 201 }))

      await addDebtPayment('debt-1', {
        amount: 50,
        currency: 'USDT',
        appliedAmount: 49.5,
        note: 'Transferencia',
        paidAt: '2026-08-30',
        walletId: 'wallet-1',
      })

      const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string)
      expect(body).toEqual({
        amount: 50,
        currency: 'USDT',
        applied_amount: 49.5,
        note: 'Transferencia',
        paid_at: '2026-08-30',
        wallet_id: 'wallet-1',
      })
    })

    it('mapea la respuesta a camelCase', async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse(DEBT_PAYMENT_WIRE, { status: 201 }))

      const result = await addDebtPayment('debt-1', { amount: 50, currency: 'USD' })

      expect(result).toEqual({
        id: 'payment-1',
        debtId: 'debt-1',
        amount: 50,
        currency: 'USD',
        appliedAmount: 50,
        note: null,
        paidAt: '2026-08-30',
        walletId: null,
        createdAt: '2026-08-30T00:00:00Z',
      })
    })

    it('lanza DebtsApiError en error', async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse({ detail: 'Saldo insuficiente.' }, { ok: false, status: 400 }))

      const error: unknown = await addDebtPayment('debt-1', { amount: 50, currency: 'USD' }).catch((e: unknown) => e)

      expect(error).toBeInstanceOf(DebtsApiError)
      expect((error as DebtsApiError).status).toBe(400)
    })
  })

  describe('deleteDebtPayment', () => {
    it('manda DELETE al endpoint del pago', async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse(null, { status: 204 }))

      await deleteDebtPayment('debt-1', 'payment-1')

      const [url, init] = vi.mocked(fetch).mock.calls[0]
      expect(url).toBe('/api/debts/debt-1/payments/payment-1')
      expect(init!.method).toBe('DELETE')
    })

    it('lanza DebtsApiError en 404', async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse({ detail: 'Pago no encontrado.' }, { ok: false, status: 404 }))

      const error: unknown = await deleteDebtPayment('debt-1', 'missing').catch((e: unknown) => e)

      expect(error).toBeInstanceOf(DebtsApiError)
      expect((error as DebtsApiError).status).toBe(404)
    })
  })

  describe('parseDebtPaymentVoice', () => {
    it('manda el transcript al endpoint de parseo', async () => {
      vi.mocked(fetch).mockResolvedValue(
        mockResponse({ amount: 50, currency: 'USDT', paid_at: '2026-08-30', note: 'ayer me pagaron 50 usdt' }),
      )

      await parseDebtPaymentVoice('debt-1', 'ayer me pagaron 50 usdt')

      const [url, init] = vi.mocked(fetch).mock.calls[0]
      expect(url).toBe('/api/debts/debt-1/payments/parse-voice')
      expect(init!.method).toBe('POST')
      expect(JSON.parse(init!.body as string)).toEqual({ transcript: 'ayer me pagaron 50 usdt' })
    })

    it('mapea la respuesta a camelCase', async () => {
      vi.mocked(fetch).mockResolvedValue(
        mockResponse({ amount: 50, currency: 'USDT', paid_at: '2026-08-30', note: 'ayer me pagaron 50 usdt' }),
      )

      const result = await parseDebtPaymentVoice('debt-1', 'ayer me pagaron 50 usdt')

      expect(result).toEqual({ amount: 50, currency: 'USDT', paidAt: '2026-08-30', note: 'ayer me pagaron 50 usdt' })
    })

    it('lanza DebtsApiError en error', async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse({ detail: 'Deuda no encontrada.' }, { ok: false, status: 404 }))

      const error: unknown = await parseDebtPaymentVoice('debt-1', 'hoy me pagaron 50').catch((e: unknown) => e)

      expect(error).toBeInstanceOf(DebtsApiError)
    })
  })
})
