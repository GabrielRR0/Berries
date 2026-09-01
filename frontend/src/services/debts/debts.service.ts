// Servicio fetch-based del dominio debts (mismo patron que
// services/auth/auth.service.ts): funciones planas, sin axios, que mapean la
// respuesta snake_case del backend a interfaces TS en camelCase. A
// diferencia de auth, cada funcion aca requiere sesion: se lee el token
// actual llamando useAuthStore() adentro de cada funcion (nunca se cachea a
// nivel de modulo) y se manda como Authorization: Bearer <token>.

import { useAuthStore } from '../../stores/auth.store'
import type {
  CreateDebtInput,
  CreateDebtPaymentInput,
  Debt,
  DebtDirection,
  DebtPayment,
  DebtPaymentVoicePreview,
  DebtSummary,
  Installment,
  InstallmentStatus,
} from './interfaces/debts.interface'

// Forma "sobre el cable" tal cual la devuelve el backend (ver
// berry/backend/app/schemas/debts/*) - solo interna a este archivo, el resto
// de la app siempre trabaja con Debt/Installment/DebtSummary.
// "number | string" en cada monto: son Decimal de Pydantic, que llegan como string
// sobre el cable (mismo motivo/mismo criterio que wallets.service.ts/WalletWire.balance) -
// formatCurrency.ts llama ".toFixed()" a mano para USDT (Intl.NumberFormat no la
// reconoce), y un string ahi rompe en silencio si no se convierte antes con Number().
interface InstallmentWire {
  id: string
  debt_id: string
  due_date: string
  amount: number | string
  status: InstallmentStatus
  paid_at: string | null
}

interface DebtPaymentWire {
  id: string
  debt_id: string
  amount: number | string
  currency: string
  applied_amount: number | string
  note: string | null
  paid_at: string
  wallet_id: string | null
  created_at: string
}

interface DebtWire {
  id: string
  user_id: string
  counterparty_name: string
  direction: DebtDirection
  total_amount: number | string
  currency: string
  description: string | null
  created_at: string
  installments: InstallmentWire[]
  payments: DebtPaymentWire[]
  amount_paid: number | string
  remaining_amount: number | string
}

interface DebtPaymentVoicePreviewWire {
  amount: number | string | null
  currency: string
  paid_at: string
  note: string
}

interface DebtSummaryWire {
  total_owed_by_user: number | string
  total_owed_to_user: number | string
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
    amount: Number(wire.amount),
    status: wire.status,
    paidAt: wire.paid_at,
  }
}

function mapDebtPayment(wire: DebtPaymentWire): DebtPayment {
  return {
    id: wire.id,
    debtId: wire.debt_id,
    amount: Number(wire.amount),
    currency: wire.currency,
    appliedAmount: Number(wire.applied_amount),
    note: wire.note,
    paidAt: wire.paid_at,
    walletId: wire.wallet_id,
    createdAt: wire.created_at,
  }
}

function mapDebt(wire: DebtWire): Debt {
  return {
    id: wire.id,
    userId: wire.user_id,
    counterpartyName: wire.counterparty_name,
    direction: wire.direction,
    totalAmount: Number(wire.total_amount),
    currency: wire.currency,
    description: wire.description,
    createdAt: wire.created_at,
    installments: wire.installments.map(mapInstallment),
    payments: wire.payments.map(mapDebtPayment),
    amountPaid: Number(wire.amount_paid),
    remainingAmount: Number(wire.remaining_amount),
  }
}

function mapDebtPaymentVoicePreview(wire: DebtPaymentVoicePreviewWire): DebtPaymentVoicePreview {
  return {
    amount: wire.amount === null ? null : Number(wire.amount),
    currency: wire.currency,
    paidAt: wire.paid_at,
    note: wire.note,
  }
}

function mapDebtSummary(wire: DebtSummaryWire): DebtSummary {
  return {
    totalOwedByUser: Number(wire.total_owed_by_user),
    totalOwedToUser: Number(wire.total_owed_to_user),
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

export async function addDebtPayment(debtId: string, input: CreateDebtPaymentInput): Promise<DebtPayment> {
  const payload: Record<string, unknown> = { amount: input.amount, currency: input.currency }
  if (input.appliedAmount !== undefined) payload.applied_amount = input.appliedAmount
  if (input.note) payload.note = input.note
  if (input.paidAt) payload.paid_at = input.paidAt
  if (input.walletId) payload.wallet_id = input.walletId

  const response = await fetch(`${API_BASE_URL}/api/debts/${debtId}/payments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    throw new DebtsApiError(await parseErrorMessage(response, 'No se pudo registrar el pago.'), response.status)
  }

  return mapDebtPayment((await response.json()) as DebtPaymentWire)
}

export async function deleteDebtPayment(debtId: string, paymentId: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/debts/${debtId}/payments/${paymentId}`, {
    method: 'DELETE',
    headers: { ...authHeaders() },
  })

  if (!response.ok) {
    throw new DebtsApiError(await parseErrorMessage(response, 'No se pudo eliminar el pago.'), response.status)
  }
}

export async function parseDebtPaymentVoice(debtId: string, transcript: string): Promise<DebtPaymentVoicePreview> {
  const response = await fetch(`${API_BASE_URL}/api/debts/${debtId}/payments/parse-voice`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ transcript }),
  })

  if (!response.ok) {
    throw new DebtsApiError(await parseErrorMessage(response, 'No se pudo interpretar el audio.'), response.status)
  }

  return mapDebtPaymentVoicePreview((await response.json()) as DebtPaymentVoicePreviewWire)
}
