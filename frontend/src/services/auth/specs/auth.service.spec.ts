import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  AuthApiError,
  checkGoogleAccountExists,
  deleteAccount,
  fetchCurrentUser,
  googleLogin,
  loginUser,
  registerUser,
} from '../auth.service'

function mockResponse(body: unknown, init: { ok?: boolean; status?: number } = {}): Response {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    json: async () => body,
  } as unknown as Response
}

const USER_WIRE = {
  id: 'user-1',
  email: 'ash@example.com',
  display_name: 'Ash',
  default_currency: 'USD',
  created_at: '2026-01-01T00:00:00Z',
}

const TOKEN_WIRE = { access_token: 'jwt-token', token_type: 'bearer', user: USER_WIRE }

describe('auth.service', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('registerUser', () => {
    it('manda email y password en JSON, sin display_name cuando no se da', async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse(TOKEN_WIRE, { status: 201 }))

      await registerUser('ash@example.com', 'password123')

      const [url, init] = vi.mocked(fetch).mock.calls[0]
      expect(url).toBe('/api/auth/register')
      expect(init!.method).toBe('POST')
      expect(init!.headers).toEqual({ 'Content-Type': 'application/json' })
      const body = JSON.parse(init!.body as string)
      expect(body).toEqual({ email: 'ash@example.com', password: 'password123' })
    })

    it('incluye display_name cuando se da', async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse(TOKEN_WIRE, { status: 201 }))

      await registerUser('ash@example.com', 'password123', 'Ash')

      const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string)
      expect(body).toEqual({ email: 'ash@example.com', password: 'password123', display_name: 'Ash' })
    })

    it('incluye default_currency y wallets (en snake_case) cuando se dan', async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse(TOKEN_WIRE, { status: 201 }))

      await registerUser('ash@example.com', 'password123', undefined, 'VEF', [
        { name: 'Facebank', currency: 'USD', initialBalance: 150.5 },
      ])

      const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string)
      expect(body).toEqual({
        email: 'ash@example.com',
        password: 'password123',
        default_currency: 'VEF',
        wallets: [{ name: 'Facebank', currency: 'USD', initial_balance: 150.5 }],
      })
    })

    it('omite wallets cuando la lista viene vacia', async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse(TOKEN_WIRE, { status: 201 }))

      await registerUser('ash@example.com', 'password123', undefined, undefined, [])

      const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string)
      expect(body).toEqual({ email: 'ash@example.com', password: 'password123' })
    })

    it('mapea la respuesta snake_case del backend a camelCase', async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse(TOKEN_WIRE, { status: 201 }))

      const result = await registerUser('ash@example.com', 'password123')

      expect(result).toEqual({
        accessToken: 'jwt-token',
        tokenType: 'bearer',
        user: {
          id: 'user-1',
          email: 'ash@example.com',
          displayName: 'Ash',
          defaultCurrency: 'USD',
          createdAt: '2026-01-01T00:00:00Z',
        },
      })
    })

    it('lanza AuthApiError con el status y el detail del backend en 409 (email ya registrado)', async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse({ detail: 'Email ya registrado.' }, { ok: false, status: 409 }))

      const error: unknown = await registerUser('ash@example.com', 'password123').catch((e: unknown) => e)

      expect(error).toBeInstanceOf(AuthApiError)
      expect((error as AuthApiError).status).toBe(409)
      expect((error as AuthApiError).message).toBe('Email ya registrado.')
    })

    it('lanza AuthApiError en 403 (limite de beta alcanzado)', async () => {
      vi.mocked(fetch).mockResolvedValue(
        mockResponse({ detail: 'Límite de usuarios beta alcanzado.' }, { ok: false, status: 403 }),
      )

      const error: unknown = await registerUser('ash@example.com', 'password123').catch((e: unknown) => e)

      expect(error).toBeInstanceOf(AuthApiError)
      expect((error as AuthApiError).status).toBe(403)
    })
  })

  describe('loginUser', () => {
    it('manda email y password en JSON al endpoint de login', async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse(TOKEN_WIRE))

      await loginUser('ash@example.com', 'password123')

      const [url, init] = vi.mocked(fetch).mock.calls[0]
      expect(url).toBe('/api/auth/login')
      expect(JSON.parse(init!.body as string)).toEqual({ email: 'ash@example.com', password: 'password123' })
    })

    it('mapea la respuesta a camelCase', async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse(TOKEN_WIRE))

      const result = await loginUser('ash@example.com', 'password123')

      expect(result.accessToken).toBe('jwt-token')
      expect(result.user.displayName).toBe('Ash')
    })

    it('lanza AuthApiError con status 401 en credenciales invalidas', async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse({ detail: 'Credenciales inválidas.' }, { ok: false, status: 401 }))

      const error: unknown = await loginUser('ash@example.com', 'mala').catch((e: unknown) => e)

      expect(error).toBeInstanceOf(AuthApiError)
      expect((error as AuthApiError).status).toBe(401)
      expect((error as AuthApiError).message).toBe('Credenciales inválidas.')
    })
  })

  describe('googleLogin', () => {
    it('manda el id_token en JSON al endpoint de google', async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse(TOKEN_WIRE))

      await googleLogin('id-token-de-google')

      const [url, init] = vi.mocked(fetch).mock.calls[0]
      expect(url).toBe('/api/auth/google')
      expect(JSON.parse(init!.body as string)).toEqual({ id_token: 'id-token-de-google' })
    })

    it('incluye default_currency cuando se da', async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse(TOKEN_WIRE))

      await googleLogin('id-token-de-google', 'VEF')

      const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string)
      expect(body).toEqual({ id_token: 'id-token-de-google', default_currency: 'VEF' })
    })

    it('incluye wallets (en snake_case) cuando se dan', async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse(TOKEN_WIRE))

      await googleLogin('id-token-de-google', 'VEF', [{ name: 'Facebank', currency: 'USD', initialBalance: 150.5 }])

      const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string)
      expect(body).toEqual({
        id_token: 'id-token-de-google',
        default_currency: 'VEF',
        wallets: [{ name: 'Facebank', currency: 'USD', initial_balance: 150.5 }],
      })
    })

    it('omite wallets cuando la lista viene vacia', async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse(TOKEN_WIRE))

      await googleLogin('id-token-de-google', undefined, [])

      const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string)
      expect(body).toEqual({ id_token: 'id-token-de-google' })
    })

    it('mapea la respuesta a camelCase', async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse(TOKEN_WIRE))

      const result = await googleLogin('id-token-de-google')

      expect(result.accessToken).toBe('jwt-token')
      expect(result.user.displayName).toBe('Ash')
    })

    it('lanza AuthApiError cuando el token de google es invalido', async () => {
      vi.mocked(fetch).mockResolvedValue(
        mockResponse({ detail: 'Token de Google inválido o expirado' }, { ok: false, status: 400 }),
      )

      const error: unknown = await googleLogin('token-vencido').catch((e: unknown) => e)

      expect(error).toBeInstanceOf(AuthApiError)
      expect((error as AuthApiError).status).toBe(400)
    })
  })

  describe('checkGoogleAccountExists', () => {
    it('manda el id_token en JSON al endpoint de check', async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse({ exists: true }))

      await checkGoogleAccountExists('id-token-de-google')

      const [url, init] = vi.mocked(fetch).mock.calls[0]
      expect(url).toBe('/api/auth/google/check')
      expect(JSON.parse(init!.body as string)).toEqual({ id_token: 'id-token-de-google' })
    })

    it('devuelve true si la cuenta ya existe', async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse({ exists: true }))

      expect(await checkGoogleAccountExists('id-token')).toBe(true)
    })

    it('devuelve false si la cuenta no existe todavia', async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse({ exists: false }))

      expect(await checkGoogleAccountExists('id-token')).toBe(false)
    })

    it('lanza AuthApiError si el token de google es invalido', async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse({ detail: 'Token de Google inválido' }, { ok: false, status: 400 }))

      const error: unknown = await checkGoogleAccountExists('token-vencido').catch((e: unknown) => e)

      expect(error).toBeInstanceOf(AuthApiError)
      expect((error as AuthApiError).status).toBe(400)
    })
  })

  describe('deleteAccount', () => {
    it('manda el token como Authorization: Bearer con method DELETE', async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse(null, { status: 204 }))

      await deleteAccount('jwt-token')

      const [url, init] = vi.mocked(fetch).mock.calls[0]
      expect(url).toBe('/api/auth/me')
      expect(init!.method).toBe('DELETE')
      expect(init!.headers).toEqual({ Authorization: 'Bearer jwt-token' })
    })

    it('lanza AuthApiError si el backend rechaza el borrado', async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse({ detail: 'No autenticado.' }, { ok: false, status: 401 }))

      const error: unknown = await deleteAccount('token-vencido').catch((e: unknown) => e)

      expect(error).toBeInstanceOf(AuthApiError)
      expect((error as AuthApiError).status).toBe(401)
    })
  })

  describe('fetchCurrentUser', () => {
    it('manda el token como Authorization: Bearer', async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse(USER_WIRE))

      await fetchCurrentUser('jwt-token')

      const [url, init] = vi.mocked(fetch).mock.calls[0]
      expect(url).toBe('/api/auth/me')
      expect(init!.headers).toEqual({ Authorization: 'Bearer jwt-token' })
    })

    it('mapea el usuario a camelCase', async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse(USER_WIRE))

      const result = await fetchCurrentUser('jwt-token')

      expect(result).toEqual({
        id: 'user-1',
        email: 'ash@example.com',
        displayName: 'Ash',
        defaultCurrency: 'USD',
        createdAt: '2026-01-01T00:00:00Z',
      })
    })

    it('lanza AuthApiError con status 401 si el token es invalido o falta', async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse({ detail: 'No autenticado.' }, { ok: false, status: 401 }))

      const error: unknown = await fetchCurrentUser('token-vencido').catch((e: unknown) => e)

      expect(error).toBeInstanceOf(AuthApiError)
      expect((error as AuthApiError).status).toBe(401)
    })
  })
})
