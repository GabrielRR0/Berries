import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { useAuthStore } from '../auth.store'
import { useCurrencyStore } from '../currency.store'

describe('currency.store', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('arranca en USD cuando no hay usuario cargado todavia', () => {
    const store = useCurrencyStore()

    expect(store.displayCurrency).toBe('USD')
  })

  it('arranca en el defaultCurrency del usuario logueado si ya esta cargado', () => {
    const authStore = useAuthStore()
    authStore.user = {
      id: 'user-1',
      email: 'ash@example.com',
      displayName: 'Ash',
      defaultCurrency: 'EUR',
      createdAt: '2026-01-01T00:00:00Z',
    }

    const store = useCurrencyStore()

    expect(store.displayCurrency).toBe('EUR')
  })

  it('setDisplayCurrency cambia la moneda activa', () => {
    const store = useCurrencyStore()

    store.setDisplayCurrency('VEF')

    expect(store.displayCurrency).toBe('VEF')
  })

  // Bug real reportado por el usuario ("si el cliente tiene euros que se
  // vea en euros"): en un refresh de pagina normal, authStore.user arranca
  // en null y recien se repuebla despues via fetchMe() (asincronico) - el
  // store de moneda se creaba ANTES de eso y quedaba fijo en 'USD' para
  // siempre, sin importar la moneda real del usuario.
  it('sincroniza la moneda real del usuario apenas termina de cargar (aunque el store ya existia)', async () => {
    const authStore = useAuthStore()
    const store = useCurrencyStore()
    expect(store.displayCurrency).toBe('USD') // todavia no hay usuario cargado

    authStore.user = {
      id: 'user-1',
      email: 'ash@example.com',
      displayName: 'Ash',
      defaultCurrency: 'EUR',
      createdAt: '2026-01-01T00:00:00Z',
    }
    await Promise.resolve() // deja correr el watcher

    expect(store.displayCurrency).toBe('EUR')
  })

  it('un cambio manual (el toggle de BalanceCard) no se pisa cuando el usuario termina de cargar despues', async () => {
    const authStore = useAuthStore()
    const store = useCurrencyStore()

    store.setDisplayCurrency('USDT')
    authStore.user = {
      id: 'user-1',
      email: 'ash@example.com',
      displayName: 'Ash',
      defaultCurrency: 'EUR',
      createdAt: '2026-01-01T00:00:00Z',
    }
    await Promise.resolve()

    expect(store.displayCurrency).toBe('USDT')
  })

  it('cerrar sesion libera el override manual, para que la cuenta siguiente sincronice su propia moneda', async () => {
    const authStore = useAuthStore()
    authStore.token = 'token-1'
    const store = useCurrencyStore()

    store.setDisplayCurrency('USDT') // eleccion manual de la sesion anterior
    authStore.token = null // logout
    await Promise.resolve()

    authStore.user = {
      id: 'user-2',
      email: 'otra@example.com',
      displayName: 'Otra',
      defaultCurrency: 'COP',
      createdAt: '2026-01-01T00:00:00Z',
    }
    await Promise.resolve()

    expect(store.displayCurrency).toBe('COP')
  })
})
