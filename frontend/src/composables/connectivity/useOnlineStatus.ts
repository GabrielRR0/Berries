import { ref } from 'vue'

// Estado compartido a nivel de modulo (mismo criterio que usePageTransition.ts/
// useOnboardingTour.ts) - pedido explicito del usuario: modo offline, donde la app
// necesita saber en TODO momento si hay señal, sin importar que pantalla este
// montada. Un ref por cada llamada perderia los eventos que ocurren mientras
// ningun componente que lo use esta montado; este unico ref + listeners
// registrados una sola vez (evaluacion de modulo, JS cachea el import) vive
// durante toda la sesion.
const isOnline = ref(navigator.onLine)

window.addEventListener('online', () => {
  isOnline.value = true
})
window.addEventListener('offline', () => {
  isOnline.value = false
})

export function useOnlineStatus() {
  return { isOnline }
}
