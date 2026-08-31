// Servicio fetch-based del dominio wallets (mismo patron que
// services/auth/auth.service.ts): funciones planas, sin axios, que mapean la
// respuesta snake_case del backend (ver
// berry/backend/app/schemas/wallets/wallet_schemas.py) a interfaces TS en
// camelCase. Sin un cliente API compartido: el JWT se lee directo de
// useAuthStore().token en cada llamada (ver plan de Berry).
import { useAuthStore } from '../../stores/auth.store'
import type { TransferParams, TransferResult, Wallet } from './interfaces/wallets.interface'

// Forma "sobre el cable": "balance" es un Decimal de Pydantic, que puede
// serializarse como number o como string segun el caso - se acepta ambos y
// se normaliza a number solo para mostrar (el frontend no hace matematica de
// dinero critica con este valor, eso vive en el backend).
interface WalletWire {
  id: string
  name: string
  currency: string
  balance: number | string
  created_at: string
}

interface TransferResultWire {
  from_wallet: WalletWire
  to_wallet: WalletWire
}

export class WalletsApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'WalletsApiError'
    this.status = status
  }
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

function mapWallet(wire: WalletWire): Wallet {
  return {
    id: wire.id,
    name: wire.name,
    currency: wire.currency,
    balance: Number(wire.balance),
    createdAt: wire.created_at,
  }
}

async function parseErrorMessage(response: Response, fallback: string): Promise<string> {
  const body = await response.json().catch(() => null)
  return body?.detail ?? fallback
}

function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const token = useAuthStore().token
  return { ...extra, Authorization: `Bearer ${token}` }
}

export async function createWallet(name: string, currency: string, initialBalance?: number): Promise<Wallet> {
  const payload: { name: string; currency: string; initial_balance?: number } = { name, currency }
  if (initialBalance) payload.initial_balance = initialBalance

  const response = await fetch(`${API_BASE_URL}/api/wallets`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    throw new WalletsApiError(await parseErrorMessage(response, 'No se pudo crear la billetera.'), response.status)
  }

  return mapWallet((await response.json()) as WalletWire)
}

export async function listWallets(): Promise<Wallet[]> {
  const response = await fetch(`${API_BASE_URL}/api/wallets`, {
    headers: authHeaders(),
  })

  if (!response.ok) {
    throw new WalletsApiError(
      await parseErrorMessage(response, 'No se pudieron obtener las billeteras.'),
      response.status,
    )
  }

  const wires = (await response.json()) as WalletWire[]
  return wires.map(mapWallet)
}

export async function deleteWallet(walletId: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/wallets/${walletId}`, {
    method: 'DELETE',
    headers: authHeaders(),
  })

  if (!response.ok) {
    throw new WalletsApiError(await parseErrorMessage(response, 'No se pudo eliminar la billetera.'), response.status)
  }
}

export async function transferBetweenWallets(params: TransferParams): Promise<TransferResult> {
  const payload: Record<string, unknown> = {
    from_wallet_id: params.fromWalletId,
    to_wallet_id: params.toWalletId,
    amount: params.amount,
  }
  if (params.fee !== undefined) payload.fee = params.fee
  if (params.convertedAmount !== undefined) payload.converted_amount = params.convertedAmount

  const response = await fetch(`${API_BASE_URL}/api/wallets/transfer`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    throw new WalletsApiError(
      await parseErrorMessage(response, 'No se pudo completar la transferencia.'),
      response.status,
    )
  }

  const wire = (await response.json()) as TransferResultWire
  return { fromWallet: mapWallet(wire.from_wallet), toWallet: mapWallet(wire.to_wallet) }
}
