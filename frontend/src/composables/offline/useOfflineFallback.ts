import { DebtsApiError } from '../../services/debts/debts.service'
import { GoalsApiError } from '../../services/goals/goals.service'
import { TransactionsApiError } from '../../services/transactions/transactions.service'
import { WalletsApiError } from '../../services/wallets/wallets.service'
import { useOfflineQueueStore } from '../../stores/offlineQueue.store'
import type { PendingOperation } from '../../stores/offlineQueue.store'
import { useOnlineStatus } from '../connectivity/useOnlineStatus'

export type OfflineFallbackResult<T> = { queued: false; result: T } | { queued: true }

function isConnectivityFailure(err: unknown): boolean {
  return (
    !(err instanceof TransactionsApiError) &&
    !(err instanceof WalletsApiError) &&
    !(err instanceof DebtsApiError) &&
    !(err instanceof GoalsApiError)
  )
}

// Helper compartido por las 4 acciones que soportan modo offline (movimiento,
// transferencia, pago de deuda, aporte de meta) - evita repetir la misma rama
// online/offline 4 veces. Si el backend responde con un rechazo LEGITIMO (uno de
// los ApiError tipados: saldo insuficiente, entidad borrada, etc.) nunca se
// encola - eso es un error real que el usuario debe ver, no un problema de señal.
export async function submitWithOfflineFallback<T, Op extends PendingOperation = PendingOperation>(
  op: Omit<Op, 'id' | 'status' | 'createdAt'>,
  attemptFn: () => Promise<T>,
): Promise<OfflineFallbackResult<T>> {
  const { isOnline } = useOnlineStatus()
  const offlineQueue = useOfflineQueueStore()

  if (!isOnline.value) {
    offlineQueue.enqueue(op)
    return { queued: true }
  }

  try {
    const result = await attemptFn()
    return { queued: false, result }
  } catch (err) {
    if (isConnectivityFailure(err)) {
      offlineQueue.enqueue(op)
      return { queued: true }
    }
    throw err
  }
}
