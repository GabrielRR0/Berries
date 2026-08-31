// Servicio fetch-based del dominio debts (mismo patron que
// services/auth/auth.service.ts): funciones planas, sin axios, que mapean la
// respuesta snake_case del backend a interfaces TS en camelCase. A
// diferencia de auth, cada funcion aca requiere sesion: se lee el token
// actual llamando useAuthStore() adentro de cada funcion (nunca se cachea a
// nivel de modulo) y se manda como Authorization: Bearer <token>.

import { useAuthStore } from '../../stores/auth.store'
import type {
  CreateDebtInput,
  Debt,
  DebtDirection,
  DebtSummary,
  Installment,
  InstallmentStatus,
} from './interfaces/debts.interface'

// Forma "sobre el cable" tal cual la devuelve el backend (ver
// berry/backend/app/schemas/debts/*) - solo interna a este archivo, el resto
// de la app siempre trabaja con Debt/Installment/DebtSummary.
interface InstallmentWire {
  id: string
  debt_id: string
  due_date: string
  amount: number
  status: InstallmentStatus
  paid_at: string | null
}

interface DebtWire {
  id: string
  user_id: string
  counterparty_name: string
  direction: DebtDirection
  total_amount: number
  currency: string
  description: string | null
  created_at: string
  installments: InstallmentWire[]
}

interface DebtSummaryWire {
  total_owed_by_user: number
  total_owed_to_user: number
}

// Error tipado que carga el status HTTP ademas del mensaje (ver
// AuthApiError en auth.service.ts) para que la UI distinga casos (404 deuda
// no encontrada, 422 validacion) sin parsear el texto del mensaje.
export class DebtsApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'DebtsApiError'
    this.status = status
  }
}

// Sin VITE_API_BASE_URL, queda '' y las rutas quedan relativas ('/api/...'):
// funciona en dev via el proxy de vite.config.ts.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

function mapInstallment(wire: InstallmentWire): Installment {
  return {
    id: wire.id,
    debtId: wire.debt_id,
    dueDate: wire.due_date,
    amount: wire.amount,
    status: wire.status,
    paidAt: wire.paid_at,
  }
}

function mapDebt(wire: DebtWire): Debt {
  return {
    id: wire.id,
    userId: wire.user_id,
    counterpartyName: wire.counterparty_name,
    direction: wire.direction,
    totalAmount: wire.total_amount,
    currency: wire.currency,
    description: wire.description,
    createdAt: wire.created_at,
    installments: wire.installments.map(mapInstallment),
  }
}

function mapDebtSummary(wire: DebtSummaryWire): DebtSummary {
  return {
    totalOwedByUser: wire.total_owed_by_user,
    totalOwedToUser: wire.total_owed_to_user,
  }
}

async function parseErrorMessage(response: Response, fallback: string): Promise<string> {
  const body = await response.json().catch(() => null)
  return body?.detail ?? fallback
}

// No hay una capa "API client" compartida a proposito (ver limites del
// trabajo): cada funcion de este archivo llama useAuthStore() y arma sus
// propios headers directo en el fetch.
function authHeaders(): Record<string, string> {
  const token = useAuthStore().token
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export async function createDebt(input: CreateDebtInput): Promise<Debt> {
  const payload: Record<string, unknown> = {
    counterparty_name: input.counterpartyName,
    direction: input.direction,
    total_amount: input.totalAmount,
    currency: input.currency,
  }
  if (input.description) payload.description = input.description
  if (input.installmentCount !== undefined) payload.installment_count = input.installmentCount
  if (input.firstDueDate) payload.first_due_date = input.firstDueDate
  if (input.frequencyDays !== undefined) payload.frequency_days = input.frequencyDays

  const response = await fetch(`${API_BASE_URL}/api/debts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    throw new DebtsApiError(await parseErrorMessage(response, 'No se pudo crear la deuda.'), response.status)
  }

  return mapDebt((await response.json()) as DebtWire)
}

export async function listDebts(direction?: DebtDirection): Promise<Debt[]> {
  const query = direction ? `?direction=${direction}` : ''

  const response = await fetch(`${API_BASE_URL}/api/debts${query}`, {
    headers: { ...authHeaders() },
  })

  if (!response.ok) {
    throw new DebtsApiError(await parseErrorMessage(response, 'No se pudieron obtener las deudas.'), response.status)
  }

  return ((await response.json()) as DebtWire[]).map(mapDebt)
}

export async function getDebtSummary(): Promise<DebtSummary> {
  const response = await fetch(`${API_BASE_URL}/api/debts/summary`, {
    headers: { ...authHeaders() },
  })

  if (!response.ok) {
    throw new DebtsApiError(await parseErrorMessage(response, 'No se pudo obtener el resumen de deudas.'), response.status)
  }

  return mapDebtSummary((await response.json()) as DebtSummaryWire)
}

export async function deleteDebt(debtId: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/debts/${debtId}`, {
    method: 'DELETE',
    headers: { ...authHeaders() },
  })

  if (!response.ok) {
    throw new DebtsApiError(await parseErrorMessage(response, 'No se pudo eliminar la deuda.'), response.status)
  }
}

export async function payInstallment(debtId: string, installmentId: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/debts/${debtId}/installments/${installmentId}/pay`, {
    method: 'POST',
    headers: { ...authHeaders() },
  })

  if (!response.ok) {
    throw new DebtsApiError(await parseErrorMessage(response, 'No se pudo marcar la cuota como pagada.'), response.status)
  }
}

export async function unpayInstallment(debtId: string, installmentId: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/debts/${debtId}/installments/${installmentId}/unpay`, {
    method: 'POST',
    headers: { ...authHeaders() },
  })

  if (!response.ok) {
    throw new DebtsApiError(await parseErrorMessage(response, 'No se pudo revertir el pago de la cuota.'), response.status)
  }
}
