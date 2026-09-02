import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { useAuthStore } from './auth.store'

// Estado global/cross-cutting: "en que moneda estoy viendo mi balance ahora
// mismo" (BalanceCard, WalletsMain, IncomeExpenseSummary, etc. todos leen/
// escriben esta misma preferencia). Arranca desde el defaultCurrency del
// usuario logueado si ya se cargo, y cae a 'USD' si todavia no hay usuario
// cargado.
//
// Bug real reportado por el usuario ("si el cliente tiene euros que se vea
// en euros"): auth.store.ts deja "user" en null incluso con un token
// valido - fetchMe() lo repuebla RECIEN despues, de forma asincronica (ver
// App.vue). En un refresh de pagina normal, quien primero llama
// useCurrencyStore() (tipicamente BalanceCard.vue, en su propio setup()) lo
// hace ANTES de que esa promesa resuelva, asi que el ref de arriba quedaba
// fijo en el fallback 'USD' PARA SIEMPRE, sin importar la moneda real del
// usuario - "arranca en X" solo corria una vez, en el momento equivocado.
// Este watch sincroniza la moneda real la PRIMERA vez que el usuario
// realmente termina de cargar, pero nunca despues de eso, para no pisar un
// cambio manual del selector de moneda (setDisplayCurrency, ej. el toggle
// USD/EUR/USDT de BalanceCard.vue).
export const useCurrencyStore = defineStore('currency', () => {
  const authStore = useAuthStore()
  const displayCurrency = ref(authStore.user?.defaultCurrency ?? 'USD')
  let hasManualOverride = false

  watch(
    () => authStore.user,
    (user) => {
      if (user && !hasManualOverride) {
        displayCurrency.value = user.defaultCurrency
      }
    },
  )

  // Reset del override manual al cerrar sesion - sin esto, si OTRA cuenta
  // inicia sesion despues en la misma pestaña (sin recargar la pagina), el
  // watch de arriba quedaria bloqueado por una eleccion manual de la sesion
  // ANTERIOR y nunca sincronizaria la moneda del usuario nuevo.
  watch(
    () => authStore.token,
    (token) => {
      if (token === null) hasManualOverride = false
    },
  )

  function setDisplayCurrency(code: string): void {
    hasManualOverride = true
    displayCurrency.value = code
  }

  return { displayCurrency, setDisplayCurrency }
})
