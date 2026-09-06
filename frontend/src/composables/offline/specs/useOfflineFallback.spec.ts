import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TransactionsApiError } from '../../../services/transactions/transactions.service'
import { useOfflineQueueStore } from '../../../stores/offlineQueue.store'
import { useOnlineStatus } from '../../connectivity/useOnlineStatus'
import { submitWithOfflineFallback } from '../useOfflineFallback'

function buildOp() {
  return {
    kind: 'transaction' as const,
    payload: { walletId: 'w1', type: 'expense', amount: 100, category: 'comida' } as never,
    snapshot: { walletName: 'Efectivo', walletCurrency: 'CLP', type: 'expense' as const, amount: 100, category: 'comida' },
  }
}

describe('useOfflineFallback', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('online + exito: llama attemptFn, devuelve el resultado, no encola nada', async () => {
    useOnlineStatus().isOnline.value = true
    const attemptFn = vi.fn().mockResolvedValue({ id: 'tx-1' })

    const result = await submitWithOfflineFallback(buildOp(), attemptFn)

    expect(attemptFn).toHaveBeenCalledTimes(1)
    expect(result).toEqual({ queued: false, result: { id: 'tx-1' } })
    expect(useOfflineQueueStore().items).toHaveLength(0)
  })

  it('online + error real de API: relanza el error, no encola', async () => {
    useOnlineStatus().isOnline.value = true
    const apiError = new TransactionsApiError('Rechazado', 400)
    const attemptFn = vi.fn().mockRejectedValue(apiError)

    await expect(submitWithOfflineFallback(buildOp(), attemptFn)).rejects.toBe(apiError)
    expect(useOfflineQueueStore().items).toHaveLength(0)
  })

  it('online + falla de conectividad (TypeError del fetch): encola en vez de propagar', async () => {
    useOnlineStatus().isOnline.value = true
    const attemptFn = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))

    const result = await submitWithOfflineFallback(buildOp(), attemptFn)

    expect(result).toEqual({ queued: true })
    expect(useOfflineQueueStore().items).toHaveLength(1)
  })

  it('offline: nunca llama a attemptFn, encola directo', async () => {
    useOnlineStatus().isOnline.value = false
    const attemptFn = vi.fn()

    const result = await submitWithOfflineFallback(buildOp(), attemptFn)

    expect(attemptFn).not.toHaveBeenCalled()
    expect(result).toEqual({ queued: true })
    expect(useOfflineQueueStore().items).toHaveLength(1)
  })
})
