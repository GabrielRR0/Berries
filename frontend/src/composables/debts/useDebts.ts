import { ref } from 'vue'
import {
  addDebtPayment as addDebtPaymentApi,
  createDebt as createDebtApi,
  deleteDebt as deleteDebtApi,
  deleteDebtPayment as deleteDebtPaymentApi,
  getDebtSummary as getDebtSummaryApi,
  listDebts as listDebtsApi,
  payInstallment as payInstallmentApi,
  unpayInstallment as unpayInstallmentApi,
} from '../../services/debts/debts.service'
import type {
  CreateDebtInput,
  CreateDebtPaymentInput,
  Debt,
  DebtDirection,
  DebtSummary,
} from '../../services/debts/interfaces/debts.interface'

// Estado local de la pantalla de deudas (no un store de Pinia: ninguna otra
// pantalla necesita esto ahora mismo, ver limites del trabajo). Envuelve
// services/debts/debts.service.ts con refs reactivas, mismo patron que el
// resto de composables de dominio del plan de Berry (auth es la unica
// excepcion, que usa el store directo - ver auth.store.ts).
export function useDebts() {
  const debts = ref<Debt[]>([])
  const summary = ref<DebtSummary | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // Recuerda el ultimo filtro pedido para poder refrescar la lista con el
  // mismo filtro activo despues de una mutacion (crear/eliminar/pagar).
  let lastDirection: DebtDirection | undefined

  function toMessage(err: unknown, fallback: string): string {
    return err instanceof Error ? err.message : fallback
  }

  async function fetchDebts(direction?: DebtDirection): Promise<void> {
    lastDirection = direction
    isLoading.value = true
    error.value = null
    try {
      debts.value = await listDebtsApi(direction)
    } catch (err) {
      error.value = toMessage(err, 'No se pudieron obtener las deudas.')
    } finally {
      isLoading.value = false
    }
  }

  async function fetchSummary(): Promise<void> {
    try {
      summary.value = await getDebtSummaryApi()
    } catch (err) {
      error.value = toMessage(err, 'No se pudo obtener el resumen de deudas.')
    }
  }

  // Refresca lista + resumen tras cualquier mutacion, con el mismo filtro
  // que estaba activo - asi la UI nunca queda mostrando datos viejos.
  async function refetchAll(): Promise<void> {
    await Promise.all([fetchDebts(lastDirection), fetchSummary()])
  }

  async function create(input: CreateDebtInput): Promise<void> {
    isLoading.value = true
    error.value = null
    try {
      await createDebtApi(input)
      await refetchAll()
    } catch (err) {
      error.value = toMessage(err, 'No se pudo crear la deuda.')
      throw err
    } finally {
      isLoading.value = false
    }
  }

  async function remove(id: string): Promise<void> {
    error.value = null
    try {
      await deleteDebtApi(id)
      await refetchAll()
    } catch (err) {
      error.value = toMessage(err, 'No se pudo eliminar la deuda.')
      throw err
    }
  }

  async function payInstallment(debtId: string, installmentId: string): Promise<void> {
    error.value = null
    try {
      await payInstallmentApi(debtId, installmentId)
      await refetchAll()
    } catch (err) {
      error.value = toMessage(err, 'No se pudo marcar la cuota como pagada.')
      throw err
    }
  }

  async function unpayInstallment(debtId: string, installmentId: string): Promise<void> {
    error.value = null
    try {
      await unpayInstallmentApi(debtId, installmentId)
      await refetchAll()
    } catch (err) {
      error.value = toMessage(err, 'No se pudo revertir el pago de la cuota.')
      throw err
    }
  }

  async function addPayment(debtId: string, input: CreateDebtPaymentInput): Promise<void> {
    error.value = null
    try {
      await addDebtPaymentApi(debtId, input)
      await refetchAll()
    } catch (err) {
      error.value = toMessage(err, 'No se pudo registrar el pago.')
      throw err
    }
  }

  async function removePayment(debtId: string, paymentId: string): Promise<void> {
    error.value = null
    try {
      await deleteDebtPaymentApi(debtId, paymentId)
      await refetchAll()
    } catch (err) {
      error.value = toMessage(err, 'No se pudo eliminar el pago.')
      throw err
    }
  }

  return {
    debts,
    summary,
    isLoading,
    error,
    fetchDebts,
    fetchSummary,
    create,
    remove,
    payInstallment,
    unpayInstallment,
    addPayment,
    removePayment,
  }
}
