import { defineStore } from 'pinia'
import { ref } from 'vue'
import { clearCacheByPrefix } from '../utils/offlineCache/secureCache'

// Que datos se guardan en el navegador para poder verlos sin conexion (cache
// de LECTURA - billeteras/movimientos/deudas/metas/categorias, no confundir
// con offlineQueue.store.ts, que es la cola de ESCRITURAS pendientes).
// Arrancan TODOS apagados por defecto (opt-in) - mas conservador con datos
// financieros; hasta que se activa un dominio en Ajustes, ese dominio no
// tiene datos disponibles para ver sin conexion.
//
// Estos 5 booleanos en si NO son sensibles (son solo flags, no datos
// financieros) - se guardan en texto plano, a diferencia del contenido
// cacheado en cada dominio (ver secureCache.ts, que si va cifrado).
export type OfflineCacheDomain = 'wallets' | 'transactions' | 'debts' | 'goals' | 'categories'

const STORAGE_KEY = 'berry_offline_cache_prefs'

interface Preferences {
  wallets: boolean
  transactions: boolean
  debts: boolean
  goals: boolean
  categories: boolean
}

const DEFAULT_PREFERENCES: Preferences = {
  wallets: false,
  transactions: false,
  debts: false,
  goals: false,
  categories: false,
}

function loadPersisted(): Preferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_PREFERENCES }
    return { ...DEFAULT_PREFERENCES, ...JSON.parse(raw) }
  } catch {
    return { ...DEFAULT_PREFERENCES }
  }
}

// Prefijo de cache real por dominio (ver secureCache.ts) - goals/debts tienen
// varios keys sueltos, todos comparten el mismo prefijo asi que
// clearCacheByPrefix los borra a todos de una.
const CACHE_KEY_PREFIX: Record<OfflineCacheDomain, string> = {
  wallets: 'berry_cache_wallets',
  transactions: 'berry_cache_transactions',
  debts: 'berry_cache_debts',
  goals: 'berry_cache_goals',
  categories: 'berry_cache_categories',
}

export const useOfflineCachePreferencesStore = defineStore('offlineCachePreferences', () => {
  const preferences = ref<Preferences>(loadPersisted())

  function setPreference(domain: OfflineCacheDomain, enabled: boolean) {
    preferences.value[domain] = enabled
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences.value))
    // Al apagar un dominio se borra YA lo que hubiera guardado - coherente
    // con "no quiero que esto se guarde", no alcanza con solo dejar de
    // escribir a futuro.
    if (!enabled) clearCacheByPrefix(CACHE_KEY_PREFIX[domain])
  }

  return { preferences, setPreference }
})
