import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useAuthStore } from './auth.store'

// Estado global/cross-cutting: "en que moneda estoy viendo mi balance ahora
// mismo" (BalanceCard, WalletsMain, etc. todos leen/escriben esta misma
// preferencia). Arranca desde el defaultCurrency del usuario logueado si ya
// se cargo (ver auth.store.ts / App.vue fetchMe), y cae a 'USD' si todavia
// no hay usuario cargado.
export const useCurrencyStore = defineStore('currency', () => {
  const authStore = useAuthStore()
  const displayCurrency = ref(authStore.user?.defaultCurrency ?? 'USD')

  function setDisplayCurrency(code: string): void {
    displayCurrency.value = code
  }

  return { displayCurrency, setDisplayCurrency }
})
