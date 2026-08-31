// Servicio fetch-based del dominio auth (mismo patron que
// s-rank/frontend/src/services/fileSharing/sharing.service.ts): funciones
// planas, sin axios, que mapean la respuesta snake_case del backend a
// interfaces TS en camelCase. Las interfaces publicas (AuthUser/AuthResult)
// viven en interfaces/auth.interface.ts, hermana de este archivo.
import type { AuthResult, AuthUser, WalletSeed } from './interfaces/auth.interface'

// Forma "sobre el cable" tal cual la devuelve el backend (ver
// berry/backend/app/schemas/auth/auth_schemas.py) - solo interna a este
// archivo, el resto de la app siempre trabaja con AuthUser/AuthResult.
interface UserWire {
  id: string
  email: string
  display_name: string | null
  default_currency: string
  created_at: string
}

interface TokenWire {
  access_token: string
  token_type: string
  user: UserWire
}

// Error tipado que carga el status HTTP ademas del mensaje, para que la UI
// pueda distinguir casos (ej. 409 email ya registrado, 403 limite beta,
// 401 credenciales invalidas) sin parsear el texto del mensaje.
export class AuthApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'AuthApiError'
    this.status = status
  }
}

// Sin VITE_API_BASE_URL, queda '' y las rutas quedan relativas ('/api/...'):
// funciona en dev via el proxy de vite.config.ts. En produccion se define
// esta variable con la URL real del backend desplegado.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

function mapUser(wire: UserWire): AuthUser {
  return {
    id: wire.id,
    email: wire.email,
    displayName: wire.display_name,
    defaultCurrency: wire.default_currency,
    createdAt: wire.created_at,
  }
}

function mapAuthResult(wire: TokenWire): AuthResult {
  return {
    accessToken: wire.access_token,
    tokenType: wire.token_type,
    user: mapUser(wire.user),
  }
}

async function parseErrorMessage(response: Response, fallback: string): Promise<string> {
  const body = await response.json().catch(() => null)
  return body?.detail ?? fallback
}

export async function registerUser(
  email: string,
  password: string,
  displayName?: string,
  defaultCurrency?: string,
  wallets?: WalletSeed[],
  turnstileToken?: string,
): Promise<AuthResult> {
  const payload: {
    email: string
    password: string
    display_name?: string
    default_currency?: string
    wallets?: { name: string; currency: string; initial_balance: number }[]
    turnstile_token?: string
  } = { email, password }
  if (displayName) payload.display_name = displayName
  if (defaultCurrency) payload.default_currency = defaultCurrency
  if (wallets && wallets.length > 0) {
    payload.wallets = wallets.map((w) => ({ name: w.name, currency: w.currency, initial_balance: w.initialBalance }))
  }
  if (turnstileToken) payload.turnstile_token = turnstileToken

  const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    throw new AuthApiError(await parseErrorMessage(response, 'No se pudo crear la cuenta.'), response.status)
  }

  return mapAuthResult((await response.json()) as TokenWire)
}

export async function loginUser(email: string, password: string, turnstileToken?: string): Promise<AuthResult> {
  const payload: { email: string; password: string; turnstile_token?: string } = { email, password }
  if (turnstileToken) payload.turnstile_token = turnstileToken

  const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    throw new AuthApiError(await parseErrorMessage(response, 'Credenciales invalidas.'), response.status)
  }

  return mapAuthResult((await response.json()) as TokenWire)
}

export async function googleLogin(
  idToken: string,
  defaultCurrency?: string,
  wallets?: WalletSeed[],
): Promise<AuthResult> {
  const payload: {
    id_token: string
    default_currency?: string
    wallets?: { name: string; currency: string; initial_balance: number }[]
  } = { id_token: idToken }
  if (defaultCurrency) payload.default_currency = defaultCurrency
  if (wallets && wallets.length > 0) {
    payload.wallets = wallets.map((w) => ({ name: w.name, currency: w.currency, initial_balance: w.initialBalance }))
  }

  const response = await fetch(`${API_BASE_URL}/api/auth/google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    throw new AuthApiError(await parseErrorMessage(response, 'No se pudo iniciar sesión con Google.'), response.status)
  }

  return mapAuthResult((await response.json()) as TokenWire)
}

export async function checkGoogleAccountExists(idToken: string): Promise<boolean> {
  const response = await fetch(`${API_BASE_URL}/api/auth/google/check`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id_token: idToken }),
  })

  if (!response.ok) {
    throw new AuthApiError(await parseErrorMessage(response, 'No se pudo verificar la cuenta de Google.'), response.status)
  }

  const body = (await response.json()) as { exists: boolean }
  return body.exists
}

export async function deleteAccount(token: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!response.ok) {
    throw new AuthApiError(await parseErrorMessage(response, 'No se pudo eliminar la cuenta.'), response.status)
  }
}

export async function fetchCurrentUser(token: string): Promise<AuthUser> {
  const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!response.ok) {
    throw new AuthApiError(await parseErrorMessage(response, 'No se pudo obtener el usuario.'), response.status)
  }

  return mapUser((await response.json()) as UserWire)
}
