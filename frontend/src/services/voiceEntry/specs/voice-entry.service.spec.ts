import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '../../../stores/auth.store'
import { VoiceEntryApiError, submitVoiceEntry } from '../voice-entry.service'

function mockResponse(body: unknown, init: { ok?: boolean; status?: number } = {}): Response {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    json: async () => body,
  } as unknown as Response
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

describe('voice-entry.service', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    useAuthStore().token = 'jwt-token'
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('submitVoiceEntry', () => {
    it('manda el transcript como JSON con Content-Type y Authorization', async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse(DRAFT_WIRE, { status: 201 }))

      await submitVoiceEntry('gaste veinte dolares en comida')

      const [url, init] = vi.mocked(fetch).mock.calls[0]
      expect(url).toBe('/api/voice-entry')
      expect(init!.method).toBe('POST')
      expect(init!.headers).toEqual({
        'Content-Type': 'application/json',
        Authorization: 'Bearer jwt-token',
      })
      expect(JSON.parse(init!.body as string)).toEqual({ transcript: 'gaste veinte dolares en comida' })
    })

    it('mapea la respuesta del backend (snake_case) a un Draft en camelCase', async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse(DRAFT_WIRE, { status: 201 }))

      const result = await submitVoiceEntry('gaste veinte dolares en comida')

      expect(result).toEqual(DRAFT_MAPPED)
    })

    it('lanza VoiceEntryApiError con el detail y el status del backend en un error', async () => {
      vi.mocked(fetch).mockResolvedValue(
        mockResponse({ detail: 'El monto no pudo reconocerse.' }, { ok: false, status: 400 }),
      )

      const error: unknown = await submitVoiceEntry('texto sin monto').catch((e: unknown) => e)

      expect(error).toBeInstanceOf(VoiceEntryApiError)
      expect((error as VoiceEntryApiError).status).toBe(400)
      expect((error as VoiceEntryApiError).message).toBe('El monto no pudo reconocerse.')
    })

    it('usa un mensaje de fallback en espanol si la respuesta de error no trae detail', async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse(null, { ok: false, status: 500 }))

      const error: unknown = await submitVoiceEntry('texto').catch((e: unknown) => e)

      expect((error as VoiceEntryApiError).message).toBe('No se pudo registrar el movimiento por voz.')
    })

    it('lanza VoiceEntryApiError en 401 si el token no es valido', async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse({ detail: 'No autenticado.' }, { ok: false, status: 401 }))

      const error: unknown = await submitVoiceEntry('texto').catch((e: unknown) => e)

      expect(error).toBeInstanceOf(VoiceEntryApiError)
      expect((error as VoiceEntryApiError).status).toBe(401)
    })
  })
})
