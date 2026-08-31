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
})
