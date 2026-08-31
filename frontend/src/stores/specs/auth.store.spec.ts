import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  AuthApiError,
  checkGoogleAccountExists,
  deleteAccount,
  fetchCurrentUser,
  googleLogin,
  loginUser,
  registerUser,
} from '../../services/auth/auth.service'
import { useAuthStore } from '../auth.store'

vi.mock('../../services/auth/auth.service', async () => {
  const actual = await vi.importActual<typeof import('../../services/auth/auth.service')>('../../services/auth/auth.service')
  return {
    ...actual,
    registerUser: vi.fn(),
    loginUser: vi.fn(),
    googleLogin: vi.fn(),
    checkGoogleAccountExists: vi.fn(),
    deleteAccount: vi.fn(),
    fetchCurrentUser: vi.fn(),
  }
})

const AUTH_USER = {
  id: 'user-1',
  email: 'ash@example.com',
  displayName: 'Ash',
  defaultCurrency: 'USD',
  createdAt: '2026-01-01T00:00:00Z',
}

const AUTH_RESULT = { accessToken: 'jwt-token', tokenType: 'bearer', user: AUTH_USER }

describe('auth.store', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
    vi.mocked(registerUser).mockReset()
    vi.mocked(loginUser).mockReset()
    vi.mocked(googleLogin).mockReset()
    vi.mocked(checkGoogleAccountExists).mockReset()
    vi.mocked(deleteAccount).mockReset()
    vi.mocked(fetchCurrentUser).mockReset()
  })

  it('arranca sin sesion cuando no hay token en localStorage', () => {
    const store = useAuthStore()

    expect(store.token).toBeNull()
    expect(store.user).toBeNull()
    expect(store.isAuthenticated).toBe(false)
  })

  it('restaura el token persistido al crear el store (refresh de pagina)', () => {
    localStorage.setItem('berry_auth_token', 'token-persistido')

    const store = useAuthStore()

    expect(store.token).toBe('token-persistido')
    expect(store.isAuthenticated).toBe(true)
  })

  describe('register', () => {
    it('guarda el token y el usuario, y persiste el token en localStorage', async () => {
      vi.mocked(registerUser).mockResolvedValue(AUTH_RESULT)
      const store = useAuthStore()

      await store.register('ash@example.com', 'password123', 'Ash')

      expect(registerUser).toHaveBeenCalledWith('ash@example.com', 'password123', 'Ash', undefined, undefined, undefined)
      expect(store.token).toBe('jwt-token')
      expect(store.user).toEqual(AUTH_USER)
      expect(store.isAuthenticated).toBe(true)
      expect(localStorage.getItem('berry_auth_token')).toBe('jwt-token')
    })

    it('reenvia la moneda principal, las billeteras y el token de turnstile al servicio', async () => {
      vi.mocked(registerUser).mockResolvedValue(AUTH_RESULT)
      const store = useAuthStore()
      const wallets = [{ name: 'Facebank', currency: 'USD', initialBalance: 150.5 }]

      await store.register('ash@example.com', 'password123', 'Ash', 'VEF', wallets, 'turnstile-token')

      expect(registerUser).toHaveBeenCalledWith('ash@example.com', 'password123', 'Ash', 'VEF', wallets, 'turnstile-token')
    })

    it('propaga el error del servicio sin dejar sesion a medias', async () => {
      vi.mocked(registerUser).mockRejectedValue(new AuthApiError('Email ya registrado.', 409))
      const store = useAuthStore()

      await expect(store.register('ash@example.com', 'password123')).rejects.toThrow('Email ya registrado.')
      expect(store.isAuthenticated).toBe(false)
    })
  })

  describe('login', () => {
    it('guarda el token y el usuario al iniciar sesion correctamente', async () => {
      vi.mocked(loginUser).mockResolvedValue(AUTH_RESULT)
      const store = useAuthStore()

      await store.login('ash@example.com', 'password123')

      expect(store.token).toBe('jwt-token')
      expect(store.user).toEqual(AUTH_USER)
    })

    it('reenvia el token de turnstile al servicio', async () => {
      vi.mocked(loginUser).mockResolvedValue(AUTH_RESULT)
      const store = useAuthStore()

      await store.login('ash@example.com', 'password123', 'turnstile-token')

      expect(loginUser).toHaveBeenCalledWith('ash@example.com', 'password123', 'turnstile-token')
    })

    it('propaga el error de credenciales invalidas', async () => {
      vi.mocked(loginUser).mockRejectedValue(new AuthApiError('Credenciales inválidas.', 401))
      const store = useAuthStore()

      await expect(store.login('ash@example.com', 'mala')).rejects.toThrow('Credenciales inválidas.')
      expect(store.isAuthenticated).toBe(false)
    })
  })

  describe('loginWithGoogle', () => {
    it('guarda el token y el usuario al iniciar sesion con Google', async () => {
      vi.mocked(googleLogin).mockResolvedValue(AUTH_RESULT)
      const store = useAuthStore()

      await store.loginWithGoogle('id-token-de-google')

      expect(store.token).toBe('jwt-token')
      expect(store.user).toEqual(AUTH_USER)
      expect(store.isAuthenticated).toBe(true)
      expect(localStorage.getItem('berry_auth_token')).toBe('jwt-token')
    })

    it('reenvia el idToken y la moneda principal al servicio', async () => {
      vi.mocked(googleLogin).mockResolvedValue(AUTH_RESULT)
      const store = useAuthStore()

      const seeds = [{ name: 'Facebank', currency: 'USD', initialBalance: 150.5 }]

      await store.loginWithGoogle('id-token-de-google', 'VEF', seeds)

      expect(googleLogin).toHaveBeenCalledWith('id-token-de-google', 'VEF', seeds)
    })

    it('propaga el error del servicio sin dejar sesion a medias', async () => {
      vi.mocked(googleLogin).mockRejectedValue(new AuthApiError('Token de Google inválido o expirado', 400))
      const store = useAuthStore()

      await expect(store.loginWithGoogle('token-vencido')).rejects.toThrow('Token de Google inválido o expirado')
      expect(store.isAuthenticated).toBe(false)
    })
  })

  describe('checkGoogleAccount', () => {
    it('reenvia el resultado del servicio', async () => {
      vi.mocked(checkGoogleAccountExists).mockResolvedValue(true)
      const store = useAuthStore()

      const exists = await store.checkGoogleAccount('id-token-de-google')

      expect(checkGoogleAccountExists).toHaveBeenCalledWith('id-token-de-google')
      expect(exists).toBe(true)
    })
  })

  describe('pendingGoogleIdToken (relay Login -> RegisterWizard)', () => {
    it('consumePendingGoogleIdToken devuelve null si nunca se seteo nada', () => {
      const store = useAuthStore()

      expect(store.consumePendingGoogleIdToken()).toBeNull()
    })

    it('devuelve el token seteado y lo limpia (solo se puede consumir una vez)', () => {
      const store = useAuthStore()

      store.setPendingGoogleIdToken('id-token-de-google')

      expect(store.consumePendingGoogleIdToken()).toBe('id-token-de-google')
      expect(store.consumePendingGoogleIdToken()).toBeNull()
    })
  })

  describe('deleteOwnAccount', () => {
    it('llama al servicio con el token y limpia la sesion como logout', async () => {
      vi.mocked(loginUser).mockResolvedValue(AUTH_RESULT)
      vi.mocked(deleteAccount).mockResolvedValue(undefined)
      const store = useAuthStore()
      await store.login('ash@example.com', 'password123')

      await store.deleteOwnAccount()

      expect(deleteAccount).toHaveBeenCalledWith('jwt-token')
      expect(store.token).toBeNull()
      expect(store.user).toBeNull()
      expect(localStorage.getItem('berry_auth_token')).toBeNull()
    })

    it('no hace nada si no hay sesion', async () => {
      const store = useAuthStore()

      await store.deleteOwnAccount()

      expect(deleteAccount).not.toHaveBeenCalled()
    })

    it('propaga el error del servicio sin cerrar la sesion', async () => {
      vi.mocked(loginUser).mockResolvedValue(AUTH_RESULT)
      vi.mocked(deleteAccount).mockRejectedValue(new AuthApiError('No autenticado.', 401))
      const store = useAuthStore()
      await store.login('ash@example.com', 'password123')

      await expect(store.deleteOwnAccount()).rejects.toThrow('No autenticado.')
      expect(store.isAuthenticated).toBe(true)
    })
  })

  describe('logout', () => {
    it('limpia token, usuario y localStorage', async () => {
      vi.mocked(loginUser).mockResolvedValue(AUTH_RESULT)
      const store = useAuthStore()
      await store.login('ash@example.com', 'password123')

      store.logout()

      expect(store.token).toBeNull()
      expect(store.user).toBeNull()
      expect(store.isAuthenticated).toBe(false)
      expect(localStorage.getItem('berry_auth_token')).toBeNull()
    })
  })

  describe('fetchMe', () => {
    it('no hace nada si no hay token', async () => {
      const store = useAuthStore()

      await store.fetchMe()

      expect(fetchCurrentUser).not.toHaveBeenCalled()
    })

    it('repuebla "user" cuando hay un token persistido', async () => {
      localStorage.setItem('berry_auth_token', 'token-persistido')
      vi.mocked(fetchCurrentUser).mockResolvedValue(AUTH_USER)
      const store = useAuthStore()

      await store.fetchMe()

      expect(fetchCurrentUser).toHaveBeenCalledWith('token-persistido')
      expect(store.user).toEqual(AUTH_USER)
    })

    it('cierra la sesion si el token ya no es valido (401)', async () => {
      localStorage.setItem('berry_auth_token', 'token-vencido')
      vi.mocked(fetchCurrentUser).mockRejectedValue(new AuthApiError('No autenticado.', 401))
      const store = useAuthStore()

      await expect(store.fetchMe()).rejects.toThrow('No autenticado.')

      expect(store.token).toBeNull()
      expect(store.user).toBeNull()
      expect(localStorage.getItem('berry_auth_token')).toBeNull()
    })

    it('no cierra la sesion en un error que no sea 401 (ej. de red)', async () => {
      localStorage.setItem('berry_auth_token', 'token-persistido')
      vi.mocked(fetchCurrentUser).mockRejectedValue(new Error('network error'))
      const store = useAuthStore()

      await expect(store.fetchMe()).rejects.toThrow('network error')

      expect(store.token).toBe('token-persistido')
    })
  })
})
