import { computed } from 'vue'
import { useAuthStore } from '../../stores/auth.store'

// Compartido entre App.vue (header global) y SettingsMenuMain.vue (avatar de
// la tarjeta de perfil) - antes duplicado en cada pantalla que mostraba su
// propio TopHeader.
export function useAvatarInitials() {
  const authStore = useAuthStore()
  return computed(() => {
    const name = authStore.user?.displayName || authStore.user?.email || ''
    return name.charAt(0).toUpperCase()
  })
}
