// Formas publicas del dominio goals - lo que composables/componentes conocen
// y usan. La forma "sobre el cable" (GoalWire/...) y GoalsApiError son
// detalle de implementacion de goals.service.ts.
export type GoalStatus = 'active' | 'completed' | 'abandoned'

// Plantillas fijas del paso 1 del alta ("¿Cuál es tu objetivo?") - "custom" es
// "Personalizada". Decide el icono que muestra GoalTypeIcon.vue, nunca texto libre.
export type GoalType = 'study' | 'business' | 'course' | 'housing' | 'travel' | 'vehicle' | 'computer' | 'phone' | 'custom'

export interface Goal {
  id: string
  userId: string
  title: string
  targetAmount: number
  currency: string
  targetDate: string
  totalSaved: number
  status: GoalStatus
  goalType: GoalType
  createdAt: string
  completedAt: string | null
  suggestedMonthlyContribution: number
  lastCheckInPostponed: boolean
}

export interface GoalSummary {
  totalSaved: number
  totalTarget: number
}

export interface CreateGoalInput {
  title: string
  targetAmount: number
  currency: string
  targetDate: string
  goalType: GoalType
  // Opcional - "ya tengo $700 si vendo mi laptop" (pedido explicito del usuario).
  // Se guarda como el primer GoalCheckIn de la meta (ver goal_service.create_goal),
  // el detalle de donde sale la plata queda en initialAmountNote.
  initialAmount?: number
  initialAmountNote?: string
  // Opcional - de que billetera sale ese aporte inicial, en vez de "ingreso futuro"
  // (pedido explicito del usuario). Reserva BLANDA: nunca descuenta el saldo real de
  // la billetera (ver wallet_commitment_service.py del backend).
  initialAmountWalletId?: string
}

// A diferencia de CreateGoalInput, "editar" no permite cambiar la plantilla/icono
// elegida al crear (ver goal_service.update_goal en el backend, que no acepta
// goal_type) - solo se puede corregir titulo/monto/moneda/fecha.
export interface UpdateGoalInput {
  title: string
  targetAmount: number
  currency: string
  targetDate: string
}

export interface RecordCheckInInput {
  amountSaved: number
  newTargetDate?: string
  note?: string
  // Opcional - de que billetera sale este aporte (pedido explicito del usuario, ver
  // CreateGoalInput.initialAmountWalletId).
  walletId?: string
}

export interface GoalCheckIn {
  id: string
  goalId: string
  periodMonth: string
  amountSaved: number
  previousTargetDate: string | null
  newTargetDate: string | null
  note: string | null
  walletId: string | null
  createdAt: string
}

// Edita SOLO la fuente de un aporte ya existente (a que billetera esta enlazado, y su
// nota) - pedido explicito del usuario: reenlazar un aporte que quedo como "ingreso
// futuro" una vez que esa plata efectivamente llego. Nunca monto ni fecha. Reemplazo
// completo (ambos campos siempre se mandan), mismo criterio que UpdateGoalInput.
export interface UpdateCheckInInput {
  walletId: string | null
  note: string | null
}

// Cuanto de cada billetera ya esta comprometido en aportes de metas ACTIVAS del
// usuario (ver GET /api/goals/wallet-commitments) - se usa junto con Wallet.balance
// para mostrar "disponible" en los selectores de billetera de Metas.
export interface WalletCommitment {
  walletId: string
  committedAmount: number
}

export interface PendingCheckIn {
  goalId: string
  title: string
  currency: string
  targetDate: string
  suggestedAmount: number
}

export interface GoalVoicePreview {
  title: string | null
  amount: number | null
  amountIsMonthly: boolean
  currency: string
  targetDate: string | null
}

// Promedio de ingresos/gastos reales de los ultimos meses (ver
// goal_service.get_savings_capacity, reusa analytics_service) - puramente
// informativo, nunca bloquea crear/editar una meta.
export interface SavingsCapacity {
  avgMonthlyIncome: number
  avgMonthlyExpense: number
  avgMonthlyAvailable: number
  // False mientras la cuenta no lleva al menos 1 mes calendario completo ANTERIOR
  // al actual (ver goal_service.get_savings_capacity) - pedido explicito del
  // usuario: el mes en curso todavia no termino, una sola cifra parcial no es un
  // "promedio" real. Los componentes que muestran advertencias de capacidad
  // (CreateGoalWizard.vue, GoalCard.vue) no deben mostrarlas mientras esto sea false.
  hasEnoughHistory: boolean
}
