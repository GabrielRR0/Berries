import { watch } from 'vue'
import { readCache, writeCache } from '../../utils/offlineCache/secureCache'
import { isConnectivityFailure } from '../../utils/network/isConnectivityFailure'
import { useOnlineStatus } from '../connectivity/useOnlineStatus'
import { useToast } from '../toast/useToast'

// Envuelve un fetch de lectura con cache offline: sirve datos guardados
// cuando falla por falta de señal, en vez de dejar la pantalla vacía o
// mostrar un error de red. Un solo helper reusado por los puntos de fetch de
// wallets, transactions, debts, goals y categories.
export interface FetchWithOfflineCacheParams<T> {
  isCachingEnabled: boolean
  cacheKey: string
  fetchFn: () => Promise<T>
  // Fetch exitoso: siempre pisa lo que hubiera en memoria con el dato fresco.
  onSuccess: (data: T) => void
  // Fallback por falta de señal: el propio caller decide si pisar memoria
  // (normalmente solo si estaba vacia, para no pisar datos ya buenos de la
  // sesion actual con una copia vieja de cache).
  onCacheFallback: (data: T) => void
  // Rechazo REAL del backend (no de conexion) - va a error.value, como hoy.
  onRealError: (message: string) => void
}

// Se resetea solo al volver la señal - evita mostrar un toast por cada
// dominio que falla a la vez (ej. Inicio pide wallets+transactions juntos)
// cada vez que el usuario cambia de pantalla estando ya offline.
let hasNotifiedThisOfflineStreak = false
watch(useOnlineStatus().isOnline, (online) => {
  if (online) hasNotifiedThisOfflineStreak = false
})

function notifyOfflineFallback(isCachingEnabled: boolean, hasCachedData: boolean) {
  if (hasNotifiedThisOfflineStreak) return
  hasNotifiedThisOfflineStreak = true

  const { showToast } = useToast()
  if (!isCachingEnabled) {
    showToast('Sin conexión. Activá "Modo offline" en Ajustes para ver esto sin conexión.', 'info')
  } else if (hasCachedData) {
    showToast('Sin conexión — mostrando datos guardados.', 'info')
  } else {
    showToast('Sin conexión y todavía no hay datos guardados.', 'info')
  }
}

export async function fetchWithOfflineCache<T>(params: FetchWithOfflineCacheParams<T>): Promise<void> {
  const { isOnline } = useOnlineStatus()

  async function fallbackToCache() {
    const cached = params.isCachingEnabled ? await readCache<T>(params.cacheKey) : null
    if (cached !== null) params.onCacheFallback(cached)
    notifyOfflineFallback(params.isCachingEnabled, cached !== null)
  }

  if (!isOnline.value) {
    await fallbackToCache()
    return
  }

  try {
    const data = await params.fetchFn()
    params.onSuccess(data)
    if (params.isCachingEnabled) await writeCache(params.cacheKey, data)
  } catch (err) {
    if (isConnectivityFailure(err)) {
      await fallbackToCache()
    } else {
      params.onRealError(err instanceof Error ? err.message : 'No se pudo completar la solicitud.')
      throw err
    }
  }
}
