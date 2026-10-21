<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { useRoute, type RouteLocationNormalizedLoaded } from 'vue-router'
import SectionPager from './components/layout/SectionPager.vue'
import BottomTabBar from './components/ui/BottomTabBar.vue'
import ToastBanner from './components/ui/ToastBanner.vue'
import { useOnlineStatus } from './composables/connectivity/useOnlineStatus'
import { usePageTransitionName } from './composables/navigation/usePageTransition'
import { useAuthStore } from './stores/auth.store'
import { useOfflineQueueStore } from './stores/offlineQueue.store'

const authStore = useAuthStore()
const offlineQueue = useOfflineQueueStore()
const route = useRoute()
const transitionName = usePageTransitionName()
const { isOnline } = useOnlineStatus()

// Reconexion dispara la sincronizacion sola - vive aca (no dentro del store)
// para no depender de que pantalla instancie useOfflineQueueStore() primero.
watch(isOnline, (online) => {
  if (online) offlineQueue.syncAll().catch(() => {})
})

// BottomTabBar vive UNA sola vez aca (position:fixed, fuera del paginador) -
// queda quieta mientras las secciones se deslizan por debajo.
const showChrome = computed(() => Boolean(route.meta.requiresAuth) && !route.meta.hideTabBar)

// Las secciones (rutas con meta.order) las pinta SectionPager.vue, con
// instancias persistentes; el RouterView queda solo para las pantallas
// sueltas (calculadora, crear/editar meta, tasas, ...), que entran por encima
// del paginador con el <Transition> de siempre.
const isSection = (r: RouteLocationNormalizedLoaded) => typeof r.meta.order === 'number'
const isSectionRoute = computed(() => isSection(route))

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
  <SectionPager v-if="authStore.isAuthenticated" />

  <div class="route-transition-viewport" :class="{ 'is-passthrough': isSectionRoute }">
    <RouterView v-slot="{ Component, route: currentRoute }">
      <Transition :name="transitionName">
        <component :is="Component" v-if="Component && !isSection(currentRoute)" :key="currentRoute.path" />
      </Transition>
    </RouterView>
  </div>

  <BottomTabBar v-if="showChrome" />
  <ToastBanner />
</template>
