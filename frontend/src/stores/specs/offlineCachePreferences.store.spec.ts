import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { useOfflineCachePreferencesStore } from '../offlineCachePreferences.store'

describe('offlineCachePreferences.store', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('los 5 dominios arrancan apagados por defecto', () => {
    const store = useOfflineCachePreferencesStore()

    expect(store.preferences).toEqual({
      wallets: false,
      transactions: false,
      debts: false,
      goals: false,
      categories: false,
    })
  })

  it('setPreference activa un dominio y lo persiste en localStorage', () => {
    const store = useOfflineCachePreferencesStore()

    store.setPreference('wallets', true)

    expect(store.preferences.wallets).toBe(true)
    const persisted = JSON.parse(localStorage.getItem('berry_offline_cache_prefs') ?? '{}')
    expect(persisted.wallets).toBe(true)
  })

  it('rehidrata las preferencias guardadas al crear el store de nuevo', () => {
    localStorage.setItem('berry_offline_cache_prefs', JSON.stringify({ wallets: true, goals: true }))

    const store = useOfflineCachePreferencesStore()

    expect(store.preferences.wallets).toBe(true)
    expect(store.preferences.goals).toBe(true)
    expect(store.preferences.transactions).toBe(false)
  })

  it('al desactivar un dominio, borra ya lo que hubiera guardado para ese dominio (y solo ese)', () => {
    localStorage.setItem('berry_cache_debts_list', 'algo-cifrado')
    localStorage.setItem('berry_cache_debts_summary', 'algo-cifrado')
    localStorage.setItem('berry_cache_wallets', 'algo-cifrado')
    const store = useOfflineCachePreferencesStore()
    store.setPreference('debts', true)

    store.setPreference('debts', false)

    expect(localStorage.getItem('berry_cache_debts_list')).toBeNull()
    expect(localStorage.getItem('berry_cache_debts_summary')).toBeNull()
    expect(localStorage.getItem('berry_cache_wallets')).not.toBeNull()
  })

  it('activar un dominio no toca localStorage de cache (recien el proximo fetch exitoso lo puebla)', () => {
    const store = useOfflineCachePreferencesStore()

    store.setPreference('categories', true)

    expect(localStorage.getItem('berry_cache_categories_income')).toBeNull()
  })

  it('un JSON corrupto en localStorage no rompe la rehidratacion (vuelve a los defaults)', () => {
    localStorage.setItem('berry_offline_cache_prefs', 'no-es-json-valido')

    const store = useOfflineCachePreferencesStore()

    expect(store.preferences.wallets).toBe(false)
  })
})
