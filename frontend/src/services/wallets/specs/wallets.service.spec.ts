import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '../../../stores/auth.store'
import { WalletsApiError, createWallet, deleteWallet, listWallets, transferBetweenWallets } from '../wallets.service'

function mockResponse(body: unknown, init: { ok?: boolean; status?: number } = {}): Response {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    json: async () => body,
  } as unknown as Response
}

const WALLET_WIRE = {
  id: 'wallet-1',
  name: 'Efectivo',
  currency: 'USD',
  balance: '120.50',
  created_at: '2026-01-01T00:00:00Z',
}

const WALLET_MAPPED = {
  id: 'wallet-1',
  name: 'Efectivo',
  currency: 'USD',
  balance: 120.5,
  createdAt: '2026-01-01T00:00:00Z',
}

describe('wallets.service', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    useAuthStore().token = 'jwt-token'
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('createWallet', () => {
    it('manda name y currency en JSON con Authorization: Bearer', async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse(WALLET_WIRE, { status: 201 }))

      await createWallet('Efectivo', 'USD')

      const [url, init] = vi.mocked(fetch).mock.calls[0]
      expect(url).toBe('/api/wallets')
      expect(init!.method).toBe('POST')
      expect(init!.headers).toEqual({ 'Content-Type': 'application/json', Authorization: 'Bearer jwt-token' })
      expect(JSON.parse(init!.body as string)).toEqual({ name: 'Efectivo', currency: 'USD' })
    })

    it('incluye initial_balance cuando se da', async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse(WALLET_WIRE, { status: 201 }))

      await createWallet('Facebank', 'USD', 150.5)

      expect(JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string)).toEqual({
        name: 'Facebank',
        currency: 'USD',
        initial_balance: 150.5,
      })
    })

    it('mapea el balance (string) a number y snake_case a camelCase', async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse(WALLET_WIRE, { status: 201 }))

      const result = await createWallet('Efectivo', 'USD')

      expect(result).toEqual(WALLET_MAPPED)
    })

    it('lanza WalletsApiError con el status y detail del backend', async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse({ detail: 'No autenticado.' }, { ok: false, status: 401 }))

      const error: unknown = await createWallet('Efectivo', 'USD').catch((e: unknown) => e)

      expect(error).toBeInstanceOf(WalletsApiError)
      expect((error as WalletsApiError).status).toBe(401)
      expect((error as WalletsApiError).message).toBe('No autenticado.')
    })
  })

  describe('listWallets', () => {
    it('pide GET /api/wallets con Authorization y mapea la lista completa', async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse([WALLET_WIRE]))

      const result = await listWallets()

      const [url, init] = vi.mocked(fetch).mock.calls[0]
      expect(url).toBe('/api/wallets')
      expect(init!.headers).toEqual({ Authorization: 'Bearer jwt-token' })
      expect(result).toEqual([WALLET_MAPPED])
    })

    it('lanza WalletsApiError en un error generico del servidor', async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse({ detail: 'Error interno.' }, { ok: false, status: 500 }))

      const error: unknown = await listWallets().catch((e: unknown) => e)

      expect(error).toBeInstanceOf(WalletsApiError)
      expect((error as WalletsApiError).status).toBe(500)
    })
  })

  describe('deleteWallet', () => {
    it('pide DELETE /api/wallets/{id} con Authorization', async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse(null, { status: 204 }))

      await deleteWallet('wallet-1')

      const [url, init] = vi.mocked(fetch).mock.calls[0]
      expect(url).toBe('/api/wallets/wallet-1')
      expect(init!.method).toBe('DELETE')
      expect(init!.headers).toEqual({ Authorization: 'Bearer jwt-token' })
    })

    it('lanza WalletsApiError en 404 (no es tuya o no existe)', async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse({ detail: 'No encontrada.' }, { ok: false, status: 404 }))

      const error: unknown = await deleteWallet('wallet-x').catch((e: unknown) => e)

      expect(error).toBeInstanceOf(WalletsApiError)
      expect((error as WalletsApiError).status).toBe(404)
    })
  })

  describe('transferBetweenWallets', () => {
    it('manda from/to/amount en snake_case, sin fee/converted_amount si no se dan', async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse({ from_wallet: WALLET_WIRE, to_wallet: WALLET_WIRE }))

      await transferBetweenWallets({ fromWalletId: 'w1', toWalletId: 'w2', amount: 50 })

      const [url, init] = vi.mocked(fetch).mock.calls[0]
      expect(url).toBe('/api/wallets/transfer')
      expect(init!.method).toBe('POST')
      expect(JSON.parse(init!.body as string)).toEqual({ from_wallet_id: 'w1', to_wallet_id: 'w2', amount: 50 })
    })

    it('incluye fee y converted_amount cuando se dan', async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse({ from_wallet: WALLET_WIRE, to_wallet: WALLET_WIRE }))

      await transferBetweenWallets({ fromWalletId: 'w1', toWalletId: 'w2', amount: 50, fee: 1.5, convertedAmount: 48 })

      const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string)
      expect(body).toEqual({ from_wallet_id: 'w1', to_wallet_id: 'w2', amount: 50, fee: 1.5, converted_amount: 48 })
    })

    it('mapea from_wallet/to_wallet a camelCase', async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse({ from_wallet: WALLET_WIRE, to_wallet: WALLET_WIRE }))

      const result = await transferBetweenWallets({ fromWalletId: 'w1', toWalletId: 'w2', amount: 50 })

      expect(result).toEqual({ fromWallet: WALLET_MAPPED, toWallet: WALLET_MAPPED })
    })

    it('lanza WalletsApiError en 400 (saldo insuficiente o monedas distintas sin converted_amount)', async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse({ detail: 'Fondos insuficientes.' }, { ok: false, status: 400 }))

      const error: unknown = await transferBetweenWallets({ fromWalletId: 'w1', toWalletId: 'w2', amount: 999 }).catch(
        (e: unknown) => e,
      )

      expect(error).toBeInstanceOf(WalletsApiError)
      expect((error as WalletsApiError).status).toBe(400)
      expect((error as WalletsApiError).message).toBe('Fondos insuficientes.')
    })
  })
})
