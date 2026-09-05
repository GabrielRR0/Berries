import { ref } from 'vue'
import {
  abandonGoal as abandonGoalApi,
  createGoal as createGoalApi,
  deleteGoal as deleteGoalApi,
  getGoalSummary as getGoalSummaryApi,
  getPendingCheckIns as getPendingCheckInsApi,
  getSavingsCapacity as getSavingsCapacityApi,
  getWalletCommitments as getWalletCommitmentsApi,
  listGoals as listGoalsApi,
  recordCheckIn as recordCheckInApi,
  updateCheckIn as updateCheckInApi,
  updateGoal as updateGoalApi,
} from '../../services/goals/goals.service'
import type {
  CreateGoalInput,
  Goal,
  GoalStatus,
  GoalSummary,
  PendingCheckIn,
  RecordCheckInInput,
  SavingsCapacity,
  UpdateCheckInInput,
  UpdateGoalInput,
} from '../../services/goals/interfaces/goals.interface'

// Estado local de la pantalla de metas (no un store de Pinia: ninguna otra
// pantalla necesita esto ahora mismo), mismo patron que useDebts.ts.
export function useGoals() {
  const goals = ref<Goal[]>([])
  const summary = ref<GoalSummary | null>(null)
  const pendingCheckIns = ref<PendingCheckIn[]>([])
  const savingsCapacity = ref<SavingsCapacity | null>(null)
  // Cuanto de cada billetera ya esta comprometido en metas activas (id -> monto) -
  // pedido explicito del usuario: mostrar "disponible" (saldo real menos esto) al
  // elegir una billetera para un aporte.
  const walletCommitments = ref<Record<string, number>>({})
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // Recuerda el ultimo filtro pedido para refrescar la lista con el mismo
  // filtro activo despues de una mutacion (crear/eliminar/check-in/abandonar).
  let lastStatus: GoalStatus | undefined

  function toMessage(err: unknown, fallback: string): string {
    return err instanceof Error ? err.message : fallback
  }

  async function fetchGoals(status?: GoalStatus): Promise<void> {
    lastStatus = status
    isLoading.value = true
    error.value = null
    try {
      goals.value = await listGoalsApi(status)
    } catch (err) {
      error.value = toMessage(err, 'No se pudieron obtener las metas.')
    } finally {
      isLoading.value = false
    }
  }

  async function fetchSummary(): Promise<void> {
    try {
      summary.value = await getGoalSummaryApi()
    } catch (err) {
      error.value = toMessage(err, 'No se pudo obtener el resumen de metas.')
    }
  }

  async function fetchPendingCheckIns(): Promise<void> {
    try {
      pendingCheckIns.value = await getPendingCheckInsApi()
    } catch (err) {
      error.value = toMessage(err, 'No se pudieron obtener los chequeos pendientes.')
    }
  }

  // Se pide una sola vez al montar la pantalla (no cambia con las mutaciones de
  // metas) - promedio de ingresos/gastos reales, solo informativo.
  async function fetchSavingsCapacity(): Promise<void> {
    try {
      savingsCapacity.value = await getSavingsCapacityApi()
    } catch (err) {
      error.value = toMessage(err, 'No se pudo obtener el promedio de ingresos y gastos.')
    }
  }

  async function fetchWalletCommitments(): Promise<void> {
    try {
      const commitments = await getWalletCommitmentsApi()
      walletCommitments.value = Object.fromEntries(commitments.map((c) => [c.walletId, c.committedAmount]))
    } catch (err) {
      error.value = toMessage(err, 'No se pudo obtener lo comprometido por billetera.')
    }
  }

  // Refresca lista + resumen + chequeos pendientes + comprometido por billetera tras
  // cualquier mutacion, con el mismo filtro que estaba activo - asi la UI nunca queda
  // mostrando datos viejos.
  async function refetchAll(): Promise<void> {
    await Promise.all([fetchGoals(lastStatus), fetchSummary(), fetchPendingCheckIns(), fetchWalletCommitments()])
  }

  async function create(input: CreateGoalInput): Promise<void> {
    isLoading.value = true
    error.value = null
    try {
      await createGoalApi(input)
      await refetchAll()
    } catch (err) {
      error.value = toMessage(err, 'No se pudo crear la meta.')
      throw err
    } finally {
      isLoading.value = false
    }
  }

  async function update(id: string, input: UpdateGoalInput): Promise<void> {
    isLoading.value = true
    error.value = null
    try {
      await updateGoalApi(id, input)
      await refetchAll()
    } catch (err) {
      error.value = toMessage(err, 'No se pudo editar la meta.')
      throw err
    } finally {
      isLoading.value = false
    }
  }

  async function remove(id: string): Promise<void> {
    error.value = null
    try {
      await deleteGoalApi(id)
      await refetchAll()
    } catch (err) {
      error.value = toMessage(err, 'No se pudo eliminar la meta.')
      throw err
    }
  }

  // Sirve tanto para el chequeo mensual (con newTargetDate si se pospone)
  // como para un aporte suelto (sin newTargetDate) - mismo endpoint, mismo
  // metodo, ver check_in_service.record_check_in en el backend.
  async function checkIn(goalId: string, input: RecordCheckInInput): Promise<void> {
    error.value = null
    try {
      await recordCheckInApi(goalId, input)
      await refetchAll()
    } catch (err) {
      error.value = toMessage(err, 'No se pudo registrar el aporte.')
      throw err
    }
  }

  // Edita SOLO la fuente (billetera/nota) de un aporte ya existente - pedido
  // explicito del usuario: reenlazar un aporte "a futuro" una vez que esa plata
  // efectivamente llego. Nunca monto ni fecha.
  async function updateCheckIn(goalId: string, checkInId: string, input: UpdateCheckInInput): Promise<void> {
    error.value = null
    try {
      await updateCheckInApi(goalId, checkInId, input)
      await refetchAll()
    } catch (err) {
      error.value = toMessage(err, 'No se pudo editar el aporte.')
      throw err
    }
  }

  async function abandon(goalId: string): Promise<void> {
    error.value = null
    try {
      await abandonGoalApi(goalId)
      await refetchAll()
    } catch (err) {
      error.value = toMessage(err, 'No se pudo abandonar la meta.')
      throw err
    }
  }

  return {
    goals,
    summary,
    pendingCheckIns,
    savingsCapacity,
    walletCommitments,
    isLoading,
    error,
    fetchGoals,
    fetchSummary,
    fetchPendingCheckIns,
    fetchSavingsCapacity,
    fetchWalletCommitments,
    create,
    update,
    remove,
    checkIn,
    updateCheckIn,
    abandon,
  }
}
