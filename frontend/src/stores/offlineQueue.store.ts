import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { useToast } from '../composables/toast/useToast'
import { addDebtPayment } from '../services/debts/debts.service'
import type { CreateDebtPaymentInput, DebtDirection } from '../services/debts/interfaces/debts.interface'
import { recordCheckIn } from '../services/goals/goals.service'
import type { RecordCheckInInput } from '../services/goals/interfaces/goals.interface'
import { createTransaction } from '../services/transactions/transactions.service'
import type { CreateTransactionParams, TransactionType } from '../services/transactions/interfaces/transactions.interface'
import { transferBetweenWallets } from '../services/wallets/wallets.service'
import type { TransferParams } from '../services/wallets/interfaces/wallets.interface'
import { isConnectivityFailure } from '../utils/network/isConnectivityFailure'
import { useTransactionsStore } from './transactions.store'
import { useWalletsStore } from './wallets.store'

// Cola de acciones que no se pudieron mandar al backend (sin señal, o el
// fetch en si fallo) para 4 tipos de accion - movimiento manual, pago de
// deuda, aporte de meta, transferencia. Siempre sobre entidades YA
// EXISTENTES (billetera/deuda/meta) - crear una billetera/deuda/meta nueva
// sigue necesitando conexion, no es parte de esta cola.
export type PendingStatus = 'pending' | 'syncing' | 'failed'

interface PendingBase {
  id: string
  status: PendingStatus
  errorMessage?: string
  createdAt: string
}

export interface PendingTransaction extends PendingBase {
  kind: 'transaction'
  payload: CreateTransactionParams
  snapshot: {
    walletName: string
    walletCurrency: string
    type: TransactionType
    amount: number
    category: string
    description?: string
  }
}

export interface PendingTransfer extends PendingBase {
  kind: 'transfer'
  payload: TransferParams
  snapshot: {
    fromWalletName: string
    toWalletName: string
    fromCurrency: string
    toCurrency: string
    amount: number
    fee?: number
    convertedAmount?: number
  }
}

export interface PendingDebtPayment extends PendingBase {
  kind: 'debtPayment'
  debtId: string
  payload: CreateDebtPaymentInput
  snapshot: {
    counterpartyName: string
    debtDirection: DebtDirection
    amount: number
    currency: string
  }
}

export interface PendingGoalContribution extends PendingBase {
  kind: 'goalContribution'
  goalId: string
  payload: RecordCheckInInput
  snapshot: {
    goalTitle: string
    goalCurrency: string
    amountSaved: number
  }
}

export type PendingOperation = PendingTransaction | PendingTransfer | PendingDebtPayment | PendingGoalContribution

const STORAGE_KEY = 'berry_offline_queue'

// crypto.randomUUID() solo existe en contexto seguro (HTTPS/localhost, ya el
// caso hoy) - fallback barato por si alguna vez falta, nunca debe romper el
// encolado en si.
function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

function loadPersisted(): PendingOperation[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const items = JSON.parse(raw) as PendingOperation[]
    // Un item que quedo "syncing" es de una sesion anterior interrumpida a
    // mitad de sincronizar (ej. se cerro la pestaña) - sin este reset, syncAll()
    // (que solo mira "pending") nunca lo volveria a intentar.
    return items.map((item) => (item.status === 'syncing' ? { ...item, status: 'pending' as const } : item))
  } catch {
    return []
  }
}

export const useOfflineQueueStore = defineStore('offlineQueue', () => {
  const items = ref<PendingOperation[]>(loadPersisted())
  let inFlightSync: Promise<void> | null = null

  function persist() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items.value))
  }

  const pendingCount = computed(
    () => items.value.filter((item) => item.status === 'pending' || item.status === 'syncing').length,
  )

  function enqueue<T extends PendingOperation>(op: Omit<T, 'id' | 'status' | 'createdAt'>): T {
    const item = { ...op, id: generateId(), status: 'pending', createdAt: new Date().toISOString() } as T
    items.value = [...items.value, item]
    persist()
    // Aviso inmediato - sin esto, el formulario se cierra igual que si
    // hubiera funcionado y nada avisa que en realidad quedo pendiente de
    // sincronizar.
    useToast().showToast('Sin conexión: se guardó como pendiente, se sincroniza solo.', 'info')
    return item
  }

  function discard(id: string) {
    items.value = items.value.filter((item) => item.id !== id)
    persist()
  }

  async function syncOne(item: PendingOperation): Promise<void> {
    item.status = 'syncing'
    persist()
    try {
      if (item.kind === 'transaction') await createTransaction(item.payload)
      else if (item.kind === 'transfer') await transferBetweenWallets(item.payload)
      else if (item.kind === 'debtPayment') await addDebtPayment(item.debtId, item.payload)
      else await recordCheckIn(item.goalId, item.payload)

      items.value = items.value.filter((i) => i.id !== item.id)
      persist()
      // Las 4 acciones pueden afectar saldos y/o el historial de movimientos -
      // mismo criterio que wallets.store.ts::transfer() ya usa tras una mutacion.
      await Promise.all([
        useWalletsStore().fetchWallets({ force: true }),
        useTransactionsStore().fetchTransactions({ force: true }),
      ])
    } catch (err) {
      if (isConnectivityFailure(err)) {
        // Sigue sin señal (o volvio a cortarse a mitad de sincronizar) - nunca
        // "failed" por esto, se queda "pending" para el proximo intento.
        item.status = 'pending'
      } else {
        item.status = 'failed'
        item.errorMessage = err instanceof Error ? err.message : 'No se pudo sincronizar.'
      }
      persist()
      throw err
    }
  }

  async function retry(id: string): Promise<void> {
    const item = items.value.find((i) => i.id === id)
    if (!item) return
    await syncOne(item).catch(() => {})
  }

  // Aviso al terminar una tanda de sincronizacion automatica (al reconectar) -
  // puede estar en cualquier otra pantalla cuando esto pasa solo, sin esto no
  // se enteraria salvo que entre a Inicio a mirar. Nunca se dispara en un
  // retry() manual puntual: ahi ya esta mirando la tarjeta, el cambio de
  // estado ya es aviso suficiente.
  function notifySyncOutcome(succeeded: number, failed: number) {
    if (succeeded === 0 && failed === 0) return
    const { showToast } = useToast()
    if (failed === 0) {
      showToast(succeeded === 1 ? 'Se sincronizó 1 pendiente.' : `Se sincronizaron ${succeeded} pendientes.`, 'success')
    } else if (succeeded === 0) {
      showToast(failed === 1 ? 'No se pudo sincronizar 1 pendiente.' : `No se pudieron sincronizar ${failed} pendientes.`, 'error')
    } else {
      showToast(`Se sincronizaron ${succeeded}; ${failed} no se pudo${failed === 1 ? '' : 'ieron'} sincronizar.`, 'error')
    }
  }

  async function syncAll(): Promise<void> {
    if (inFlightSync) return inFlightSync
    inFlightSync = (async () => {
      // FIFO por createdAt, cruzando los 4 tipos (no agrupado) - un aporte/pago
      // encolado despues de una transferencia puede depender mentalmente de ella
      // ya "aplicada". Nunca reintenta los que ya estan "failed" solo - eso
      // requiere un tap explicito.
      const pending = [...items.value]
        .filter((item) => item.status === 'pending')
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      let succeeded = 0
      let failed = 0
      for (const item of pending) {
        try {
          await syncOne(item)
          succeeded++
        } catch {
          if (item.status === 'failed') failed++
        }
      }
      notifySyncOutcome(succeeded, failed)
    })()
    try {
      await inFlightSync
    } finally {
      inFlightSync = null
    }
  }

  async function retryAll(): Promise<void> {
    await syncAll()
  }

  return { items, pendingCount, enqueue, discard, retry, retryAll, syncAll }
})
