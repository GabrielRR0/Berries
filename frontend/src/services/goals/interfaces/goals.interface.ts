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
}

export interface GoalCheckIn {
  id: string
  goalId: string
  periodMonth: string
  amountSaved: number
  previousTargetDate: string | null
  newTargetDate: string | null
  note: string | null
  createdAt: string
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
}
