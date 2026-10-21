import { computed } from 'vue'
import { useAuthStore } from '../../stores/auth.store'

// Compartido entre App.vue (header global) y SettingsMenuMain.vue (avatar de
// la tarjeta de perfil) - antes duplicado en cada pantalla que mostraba su
// propio TopHeader. Hasta dos letras: la inicial de las dos primeras
// palabras del nombre ("Gabriel Rodriguez" -> "GR"); con solo el email
// (o un nombre de una palabra) queda una.
export function useAvatarInitials() {
  const authStore = useAuthStore()
  return computed(() => {
    const name = authStore.user?.displayName || authStore.user?.email || ''
    const words = name.trim().split(/\s+/).filter(Boolean)
    return words
      .slice(0, 2)
      .map((word) => word.charAt(0).toUpperCase())
      .join('')
  })
}
