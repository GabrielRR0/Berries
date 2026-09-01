<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import TopHeader from './components/layout/TopHeader.vue'
import BottomTabBar from './components/ui/BottomTabBar.vue'
import { useAvatarInitials } from './composables/auth/useAvatarInitials'
import { useScrollHeader } from './composables/layout/useScrollHeader'
import { usePageTransitionName } from './composables/navigation/usePageTransition'
import { useOnboardingTour } from './composables/onboarding/useOnboardingTour'
import { useAuthStore } from './stores/auth.store'

const authStore = useAuthStore()
const route = useRoute()
const router = useRouter()
const transitionName = usePageTransitionName()
const avatarInitials = useAvatarInitials()
const { start: startTour } = useOnboardingTour()
const { isScrolled } = useScrollHeader()

// TopHeader/BottomTabBar viven UNA sola vez aca, fuera de <Transition> - no
// dentro de cada pantalla (como antes) - porque son position:fixed: si cada
// pantalla monta su propia copia, durante el swipe entre rutas quedaban dos
// headers/tab-bars superpuestos en el mismo lugar de la pantalla (se vio
// literalmente al probarlo). El "chrome" queda fijo e inmóvil; solo el
// contenido de abajo se desliza entre secciones.
const showChrome = computed(() => Boolean(route.meta.requiresAuth) && !route.meta.hideTabBar)
// El header (avatar/wordmark/ayuda) pedido explicito del usuario: solo tiene
// sentido en Inicio, que es la unica pantalla con tour guiado - en el resto
// de las pantallas el botón de "?" no tendría nada que explicar todavía.
// BottomTabBar si sigue en todas las pantallas autenticadas.
const showHeader = computed(() => route.name === 'dashboard')

function onAvatarClick() {
  router.push({ name: 'ajustes' })
}

// Repuebla "user" al recargar la pagina cuando ya hay un token persistido
// (ver stores/auth.store.ts) - sin esto, TopHeader no tendria iniciales de
// avatar hasta el proximo login/register manual. Si el token ya no es
// valido, fetchMe() se encarga de limpiar la sesion sola.
onMounted(() => {
  if (authStore.token && !authStore.user) {
    authStore.fetchMe().catch(() => {
      // Error ya manejado dentro del store (logout en 401); un error de red
      // transitorio no debe romper el arranque de la app.
    })
  }
})
</script>

<template>
  <TopHeader
    v-if="showHeader"
    :avatar-initials="avatarInitials"
    :scrolled="isScrolled"
    @avatar-click="onAvatarClick"
    @help-click="startTour"
  />

  <div class="route-transition-viewport">
    <RouterView v-slot="{ Component, route: currentRoute }">
      <Transition :name="transitionName">
        <component :is="Component" :key="currentRoute.path" />
      </Transition>
    </RouterView>
  </div>

  <BottomTabBar v-if="showChrome" />
</template>
