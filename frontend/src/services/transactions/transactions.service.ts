// Servicio fetch-based del dominio transactions (mismo patron que
// services/auth/auth.service.ts y services/wallets/wallets.service.ts): ver
// berry/backend/app/schemas/transactions/transaction_schemas.py para la
// forma exacta del backend. Cubre el ledger manual (create/list/delete) y la
// revision de drafts (voz/OCR - la captura en si todavia no existe, pero el
// endpoint de listado/confirmacion/descarte ya esta construido).
import { useAuthStore } from '../../stores/auth.store'
import type {
  ConfirmDraftParams,
  CreateTransactionParams,
  Draft,
  ListTransactionsParams,
  Transaction,
  TransactionType,
  UpdateTransactionParams,
} from './interfaces/transactions.interface'

// "amount"/"parsed_amount" son Decimal de Pydantic (number o string segun
// serializacion) - se normalizan a number solo para mostrar, igual criterio
// que wallets.service.ts.
interface TransactionWire {
  id: string
  wallet_id: string
  type: string
  amount: number | string
  reference_amount_usd: number | string | null
  category: string
  description: string | null
  occurred_at: string
  source: string
  transfer_id: string | null
  created_at: string
}

interface DraftWire {
  id: string
  source: string
  raw_input: string | null
  parsed_amount: number | string | null
  parsed_currency: string | null
  parsed_category: string | null
  parsed_description: string | null
  suggested_wallet_id: string | null
  status: string
  created_at: string
}

export class TransactionsApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'TransactionsApiError'
    this.status = status
  }
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

function mapTransaction(wire: TransactionWire): Transaction {
  return {
    id: wire.id,
    walletId: wire.wallet_id,
    type: wire.type as TransactionType,
    amount: Number(wire.amount),
    referenceAmountUsd: wire.reference_amount_usd === null ? null : Number(wire.reference_amount_usd),
    category: wire.category,
    description: wire.description,
    occurredAt: wire.occurred_at,
    source: wire.source,
    transferId: wire.transfer_id,
    createdAt: wire.created_at,
  }
}

function mapDraft(wire: DraftWire): Draft {
  return {
    id: wire.id,
    source: wire.source,
    rawInput: wire.raw_input,
    parsedAmount: wire.parsed_amount === null ? null : Number(wire.parsed_amount),
    parsedCurrency: wire.parsed_currency,
    parsedCategory: wire.parsed_category,
    parsedDescription: wire.parsed_description,
    suggestedWalletId: wire.suggested_wallet_id,
    status: wire.status,
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

export async function createTransaction(params: CreateTransactionParams): Promise<Transaction> {
  const payload: Record<string, unknown> = {
    wallet_id: params.walletId,
    type: params.type,
    amount: params.amount,
    category: params.category,
  }
  if (params.description !== undefined) payload.description = params.description
  if (params.occurredAt !== undefined) payload.occurred_at = params.occurredAt
  if (params.source !== undefined) payload.source = params.source

  const response = await fetch(`${API_BASE_URL}/api/transactions`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    throw new TransactionsApiError(
      await parseErrorMessage(response, 'No se pudo registrar el movimiento.'),
      response.status,
    )
  }

  return mapTransaction((await response.json()) as TransactionWire)
}

// Pedido explicito del usuario: "se debe poder editar los movimientos... montos,
// fecha de pago, description, wallet_id, category todo lo necesario". A diferencia de
// createTransaction, manda TODOS los campos siempre (no un PATCH parcial) - el form de
// edicion (ver TransactionForm.vue) siempre arranca con los valores actuales ya
// cargados, asi que no hay ambiguedad entre "no se mando" y "se quiso vaciar".
export async function updateTransaction(transactionId: string, params: UpdateTransactionParams): Promise<Transaction> {
  const payload = {
    wallet_id: params.walletId,
    type: params.type,
    amount: params.amount,
    category: params.category,
    description: params.description ?? null,
    occurred_at: params.occurredAt,
  }

  const response = await fetch(`${API_BASE_URL}/api/transactions/${transactionId}`, {
    method: 'PATCH',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    throw new TransactionsApiError(
      await parseErrorMessage(response, 'No se pudo editar el movimiento.'),
      response.status,
    )
  }

  return mapTransaction((await response.json()) as TransactionWire)
}

export async function listTransactions(params: ListTransactionsParams = {}): Promise<Transaction[]> {
  const query = new URLSearchParams()
  if (params.walletId) query.set('wallet_id', params.walletId)
  if (params.category) query.set('category', params.category)
  if (params.dateFrom) query.set('date_from', params.dateFrom)
  if (params.dateTo) query.set('date_to', params.dateTo)
  const queryString = query.toString()

  const response = await fetch(`${API_BASE_URL}/api/transactions${queryString ? `?${queryString}` : ''}`, {
    headers: authHeaders(),
  })

  if (!response.ok) {
    throw new TransactionsApiError(
      await parseErrorMessage(response, 'No se pudieron obtener los movimientos.'),
      response.status,
    )
  }

  const wires = (await response.json()) as TransactionWire[]
  return wires.map(mapTransaction)
}

export async function deleteTransaction(transactionId: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/transactions/${transactionId}`, {
    method: 'DELETE',
    headers: authHeaders(),
  })

  if (!response.ok) {
    throw new TransactionsApiError(
      await parseErrorMessage(response, 'No se pudo eliminar el movimiento.'),
      response.status,
    )
  }
}

export async function listDrafts(status = 'pending'): Promise<Draft[]> {
  const response = await fetch(`${API_BASE_URL}/api/transactions/drafts?status=${encodeURIComponent(status)}`, {
    headers: authHeaders(),
  })

  if (!response.ok) {
    throw new TransactionsApiError(
      await parseErrorMessage(response, 'No se pudieron obtener los borradores.'),
      response.status,
    )
  }

  const wires = (await response.json()) as DraftWire[]
  return wires.map(mapDraft)
}

export async function confirmDraft(draftId: string, params: ConfirmDraftParams): Promise<Transaction> {
  const payload: Record<string, unknown> = {
    wallet_id: params.walletId,
    type: params.type,
    final_amount: params.finalAmount,
    final_category: params.finalCategory,
  }
  if (params.finalDescription !== undefined) payload.final_description = params.finalDescription

  const response = await fetch(`${API_BASE_URL}/api/transactions/drafts/${draftId}/confirm`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    throw new TransactionsApiError(
      await parseErrorMessage(response, 'No se pudo confirmar el borrador.'),
      response.status,
    )
  }

  return mapTransaction((await response.json()) as TransactionWire)
}

export async function discardDraft(draftId: string): Promise<Draft> {
  const response = await fetch(`${API_BASE_URL}/api/transactions/drafts/${draftId}/discard`, {
    method: 'POST',
    headers: authHeaders(),
  })

  if (!response.ok) {
    throw new TransactionsApiError(
      await parseErrorMessage(response, 'No se pudo descartar el borrador.'),
      response.status,
    )
  }

  return mapDraft((await response.json()) as DraftWire)
}
