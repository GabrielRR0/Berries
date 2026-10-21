import { computed } from 'vue'
import { useAuthStore } from '../../stores/auth.store'

// Saludo del header de Inicio ("Buenas tardes" / "Hola, Gabriel"): el tramo
// del dia sale de la hora local al montar la pantalla, y el nombre de pila
// de la primera palabra del display name (o, sin nombre, de la parte local
// del email).
export function greetingForHour(hour: number): string {
  if (hour < 12) return 'Buenos días'
  if (hour < 20) return 'Buenas tardes'
  return 'Buenas noches'
}

export function firstNameOf(displayName: string | null | undefined, email: string | null | undefined): string {
  const source = displayName?.trim() || email?.split('@')[0] || ''
  const first = source.split(/\s+/)[0] ?? ''
  return first.charAt(0).toUpperCase() + first.slice(1)
}

export function useGreeting() {
  const authStore = useAuthStore()
  const greeting = greetingForHour(new Date().getHours())
  const firstName = computed(() => firstNameOf(authStore.user?.displayName, authStore.user?.email))
  return { greeting, firstName }
}
