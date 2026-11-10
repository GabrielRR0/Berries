import { computed } from 'vue'
import { useAuthStore } from '../../stores/auth.store'
import { toIsoDay } from '../../utils/analytics/periods'

// Mes (year, month 0-indexado, hora local) en que el usuario se registro en Berry: el
// "momento 0" de Analisis. Antes de ese mes no hay datos reales, asi que el selector de
// mes no deja ir mas atras. null si todavia no se conoce al usuario.
export function useRegistrationMonth() {
  const auth = useAuthStore()
  return computed(() => {
    const createdAt = auth.user?.createdAt
    if (!createdAt) return null
    const date = new Date(createdAt)
    if (Number.isNaN(date.getTime())) return null
    return { year: date.getFullYear(), month: date.getMonth() }
  })
}

// Dia de registro 'YYYY-MM-DD' (hora local), o null si no se conoce.
export function useRegistrationDay() {
  const auth = useAuthStore()
  return computed(() => {
    const createdAt = auth.user?.createdAt
    if (!createdAt) return null
    const date = new Date(createdAt)
    return Number.isNaN(date.getTime()) ? null : toIsoDay(date)
  })
}

// Recorta el inicio de un rango para que no arranque antes del registro (strings ISO se
// comparan bien lexicograficamente). Si el rango entero es anterior, queda en el dia de registro.
export function clampToRegistration(dateFrom: string, registrationDay: string | null): string {
  return registrationDay && dateFrom < registrationDay ? registrationDay : dateFrom
}
