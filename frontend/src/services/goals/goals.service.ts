// Servicio fetch-based del dominio goals (mismo patron que
// services/debts/debts.service.ts): funciones planas, sin axios, que mapean
// la respuesta snake_case del backend a interfaces TS en camelCase. Cada
// funcion lee el token actual llamando useAuthStore() adentro suyo (nunca se
// cachea a nivel de modulo) y lo manda como Authorization: Bearer <token>.

import { useAuthStore } from '../../stores/auth.store'
import type {
  CreateGoalInput,
  Goal,
  GoalCheckIn,
  GoalStatus,
  GoalSummary,
  GoalType,
  GoalVoicePreview,
  PendingCheckIn,
  RecordCheckInInput,
  SavingsCapacity,
  UpdateCheckInInput,
  UpdateGoalInput,
  WalletCommitment,
} from './interfaces/goals.interface'

// Forma "sobre el cable" tal cual la devuelve el backend (ver
// berry/backend/app/schemas/goals/goal_schemas.py) - solo interna a este
// archivo, el resto de la app siempre trabaja con Goal/GoalCheckIn/etc.
// Los montos (Decimal en el backend) llegan como number O string segun el
// valor - FastAPI/Pydantic serializa Decimal como string en el JSON (ver
// mismo criterio ya aplicado en debts.service.ts/wallets.service.ts) - de ahi
// el "number | string" en cada campo de monto y el Number(...) en cada mapper
// de abajo. Sin esto, formatCurrency.ts revienta con "x.toFixed is not a
// function" apenas la moneda es USDT (unico branch que no pasa por
// Intl.NumberFormat, que sí tolera un string).
interface GoalWire {
  id: string
  user_id: string
  title: string
  target_amount: number | string
  currency: string
  target_date: string
  total_saved: number | string
  status: GoalStatus
  goal_type: GoalType
  created_at: string
  completed_at: string | null
  suggested_monthly_contribution: number | string
  last_check_in_postponed: boolean
}

interface GoalSummaryWire {
  total_saved: number | string
  total_target: number | string
}

interface GoalCheckInWire {
  id: string
  goal_id: string
  period_month: string
  amount_saved: number | string
  previous_target_date: string | null
  new_target_date: string | null
  note: string | null
  wallet_id: string | null
  created_at: string
}

interface WalletCommitmentWire {
  wallet_id: string
  committed_amount: number | string
}

interface PendingCheckInWire {
  goal_id: string
  title: string
  currency: string
  target_date: string
  suggested_amount: number | string
}

interface GoalVoicePreviewWire {
  title: string | null
  amount: number | string | null
  amount_is_monthly: boolean
  currency: string
  target_date: string | null
}

interface SavingsCapacityWire {
  avg_monthly_income: number | string
  avg_monthly_expense: number | string
  avg_monthly_available: number | string
  has_enough_history: boolean
}

// Error tipado que carga el status HTTP ademas del mensaje (ver
// DebtsApiError en debts.service.ts) para que la UI distinga casos (404 meta
// no encontrada, 409 meta no activa, 400 validacion) sin parsear el texto.
export class GoalsApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'GoalsApiError'
    this.status = status
  }
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

function mapGoal(wire: GoalWire): Goal {
  return {
    id: wire.id,
    userId: wire.user_id,
    title: wire.title,
    targetAmount: Number(wire.target_amount),
    currency: wire.currency,
    targetDate: wire.target_date,
    totalSaved: Number(wire.total_saved),
    status: wire.status,
    goalType: wire.goal_type,
    createdAt: wire.created_at,
    completedAt: wire.completed_at,
    suggestedMonthlyContribution: Number(wire.suggested_monthly_contribution),
    lastCheckInPostponed: wire.last_check_in_postponed,
  }
}

function mapGoalSummary(wire: GoalSummaryWire): GoalSummary {
  return { totalSaved: Number(wire.total_saved), totalTarget: Number(wire.total_target) }
}

function mapCheckIn(wire: GoalCheckInWire): GoalCheckIn {
  return {
    id: wire.id,
    goalId: wire.goal_id,
    periodMonth: wire.period_month,
    amountSaved: Number(wire.amount_saved),
    previousTargetDate: wire.previous_target_date,
    newTargetDate: wire.new_target_date,
    note: wire.note,
    walletId: wire.wallet_id,
    createdAt: wire.created_at,
  }
}

function mapWalletCommitment(wire: WalletCommitmentWire): WalletCommitment {
  return { walletId: wire.wallet_id, committedAmount: Number(wire.committed_amount) }
}

function mapPendingCheckIn(wire: PendingCheckInWire): PendingCheckIn {
  return {
    goalId: wire.goal_id,
    title: wire.title,
    currency: wire.currency,
    targetDate: wire.target_date,
    suggestedAmount: Number(wire.suggested_amount),
  }
}

function mapVoicePreview(wire: GoalVoicePreviewWire): GoalVoicePreview {
  return {
    title: wire.title,
    amount: wire.amount === null ? null : Number(wire.amount),
    amountIsMonthly: wire.amount_is_monthly,
    currency: wire.currency,
    targetDate: wire.target_date,
  }
}

function mapSavingsCapacity(wire: SavingsCapacityWire): SavingsCapacity {
  return {
    avgMonthlyIncome: Number(wire.avg_monthly_income),
    avgMonthlyExpense: Number(wire.avg_monthly_expense),
    avgMonthlyAvailable: Number(wire.avg_monthly_available),
    hasEnoughHistory: wire.has_enough_history,
  }
}

async function parseErrorMessage(response: Response, fallback: string): Promise<string> {
  const body = await response.json().catch(() => null)
  return body?.detail ?? fallback
}

function authHeaders(): Record<string, string> {
  const token = useAuthStore().token
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export async function createGoal(input: CreateGoalInput): Promise<Goal> {
  const payload: {
    title: string
    target_amount: number
    currency: string
    target_date: string
    goal_type: string
    initial_amount?: number
    initial_amount_note?: string
    initial_amount_wallet_id?: string
  } = {
    title: input.title,
    target_amount: input.targetAmount,
    currency: input.currency,
    target_date: input.targetDate,
    goal_type: input.goalType,
  }
  if (input.initialAmount) payload.initial_amount = input.initialAmount
  if (input.initialAmountNote) payload.initial_amount_note = input.initialAmountNote
  if (input.initialAmountWalletId) payload.initial_amount_wallet_id = input.initialAmountWalletId

  const response = await fetch(`${API_BASE_URL}/api/goals`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    throw new GoalsApiError(await parseErrorMessage(response, 'No se pudo crear la meta.'), response.status)
  }

  return mapGoal((await response.json()) as GoalWire)
}

export async function updateGoal(goalId: string, input: UpdateGoalInput): Promise<Goal> {
  const response = await fetch(`${API_BASE_URL}/api/goals/${goalId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({
      title: input.title,
      target_amount: input.targetAmount,
      currency: input.currency,
      target_date: input.targetDate,
    }),
  })

  if (!response.ok) {
    throw new GoalsApiError(await parseErrorMessage(response, 'No se pudo editar la meta.'), response.status)
  }

  return mapGoal((await response.json()) as GoalWire)
}

export async function listGoals(status?: GoalStatus): Promise<Goal[]> {
  const query = status ? `?status=${status}` : ''

  const response = await fetch(`${API_BASE_URL}/api/goals${query}`, {
    headers: { ...authHeaders() },
  })

  if (!response.ok) {
    throw new GoalsApiError(await parseErrorMessage(response, 'No se pudieron obtener las metas.'), response.status)
  }

  return ((await response.json()) as GoalWire[]).map(mapGoal)
}

export async function getGoal(goalId: string): Promise<Goal> {
  const response = await fetch(`${API_BASE_URL}/api/goals/${goalId}`, {
    headers: { ...authHeaders() },
  })

  if (!response.ok) {
    throw new GoalsApiError(await parseErrorMessage(response, 'No se pudo obtener la meta.'), response.status)
  }

  return mapGoal((await response.json()) as GoalWire)
}

export async function getGoalSummary(): Promise<GoalSummary> {
  const response = await fetch(`${API_BASE_URL}/api/goals/summary`, {
    headers: { ...authHeaders() },
  })

  if (!response.ok) {
    throw new GoalsApiError(await parseErrorMessage(response, 'No se pudo obtener el resumen de metas.'), response.status)
  }

  return mapGoalSummary((await response.json()) as GoalSummaryWire)
}

export async function getPendingCheckIns(): Promise<PendingCheckIn[]> {
  const response = await fetch(`${API_BASE_URL}/api/goals/pending-check-ins`, {
    headers: { ...authHeaders() },
  })

  if (!response.ok) {
    throw new GoalsApiError(
      await parseErrorMessage(response, 'No se pudieron obtener los chequeos pendientes.'),
      response.status,
    )
  }

  return ((await response.json()) as PendingCheckInWire[]).map(mapPendingCheckIn)
}

export async function getSavingsCapacity(): Promise<SavingsCapacity> {
  const response = await fetch(`${API_BASE_URL}/api/goals/savings-capacity`, {
    headers: { ...authHeaders() },
  })

  if (!response.ok) {
    throw new GoalsApiError(
      await parseErrorMessage(response, 'No se pudo obtener el promedio de ingresos y gastos.'),
      response.status,
    )
  }

  return mapSavingsCapacity((await response.json()) as SavingsCapacityWire)
}

export async function deleteGoal(goalId: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/goals/${goalId}`, {
    method: 'DELETE',
    headers: { ...authHeaders() },
  })

  if (!response.ok) {
    throw new GoalsApiError(await parseErrorMessage(response, 'No se pudo eliminar la meta.'), response.status)
  }
}

export async function recordCheckIn(goalId: string, input: RecordCheckInInput): Promise<GoalCheckIn> {
  const payload: Record<string, unknown> = { amount_saved: input.amountSaved }
  if (input.newTargetDate) payload.new_target_date = input.newTargetDate
  if (input.note) payload.note = input.note
  if (input.walletId) payload.wallet_id = input.walletId

  const response = await fetch(`${API_BASE_URL}/api/goals/${goalId}/check-ins`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    throw new GoalsApiError(await parseErrorMessage(response, 'No se pudo registrar el aporte.'), response.status)
  }

  return mapCheckIn((await response.json()) as GoalCheckInWire)
}

// Edita SOLO la fuente (billetera/nota) de un aporte ya existente - pedido explicito
// del usuario: reenlazar un aporte que quedo como "ingreso futuro" una vez que esa
// plata efectivamente llego.
export async function updateCheckIn(goalId: string, checkInId: string, input: UpdateCheckInInput): Promise<GoalCheckIn> {
  const response = await fetch(`${API_BASE_URL}/api/goals/${goalId}/check-ins/${checkInId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ wallet_id: input.walletId, note: input.note }),
  })

  if (!response.ok) {
    throw new GoalsApiError(await parseErrorMessage(response, 'No se pudo editar el aporte.'), response.status)
  }

  return mapCheckIn((await response.json()) as GoalCheckInWire)
}

// Cuanto de cada billetera ya esta comprometido en metas activas - pedido explicito
// del usuario: mostrar, ademas del saldo real de siempre, un "disponible" que lo
// descuenta (ver wallet_commitment_service.py del backend).
export async function getWalletCommitments(): Promise<WalletCommitment[]> {
  const response = await fetch(`${API_BASE_URL}/api/goals/wallet-commitments`, {
    headers: { ...authHeaders() },
  })

  if (!response.ok) {
    throw new GoalsApiError(
      await parseErrorMessage(response, 'No se pudo obtener lo comprometido por billetera.'),
      response.status,
    )
  }

  return ((await response.json()) as WalletCommitmentWire[]).map(mapWalletCommitment)
}

export async function listCheckIns(goalId: string): Promise<GoalCheckIn[]> {
  const response = await fetch(`${API_BASE_URL}/api/goals/${goalId}/check-ins`, {
    headers: { ...authHeaders() },
  })

  if (!response.ok) {
    throw new GoalsApiError(await parseErrorMessage(response, 'No se pudo obtener el historial.'), response.status)
  }

  return ((await response.json()) as GoalCheckInWire[]).map(mapCheckIn)
}

export async function abandonGoal(goalId: string): Promise<Goal> {
  const response = await fetch(`${API_BASE_URL}/api/goals/${goalId}/abandon`, {
    method: 'POST',
    headers: { ...authHeaders() },
  })

  if (!response.ok) {
    throw new GoalsApiError(await parseErrorMessage(response, 'No se pudo abandonar la meta.'), response.status)
  }

  return mapGoal((await response.json()) as GoalWire)
}

export async function previewGoalVoiceEntry(transcript: string): Promise<GoalVoicePreview> {
  const response = await fetch(`${API_BASE_URL}/api/goals/voice-preview`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ transcript }),
  })

  if (!response.ok) {
    throw new GoalsApiError(await parseErrorMessage(response, 'No se pudo interpretar el audio.'), response.status)
  }

  return mapVoicePreview((await response.json()) as GoalVoicePreviewWire)
}
