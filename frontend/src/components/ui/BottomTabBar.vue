<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { isAnySheetOpen } from '../../composables/layout/useSheetPresence'
import { useQuickRegister } from '../../composables/quickRegister/useQuickRegister'
import { useOfflineQueueStore } from '../../stores/offlineQueue.store'

// Barra flotante fija - los tabs salen de route.meta.tabBar + route.meta.order
// (ver router/index.ts), no de un array propio: agregar una vista nueva a la
// barra es agregarle ese meta a su ruta, nada mas (pedido explicito del
// usuario: que sea modular). "Menu" apunta a /ajustes hasta que exista una
// pantalla de menu propia. El boton "+" de registrar movimiento se inserta
// solo en el centro de la lista, sea cual sea la cantidad de tabs.
const router = useRouter()
const tabs = computed(() =>
  router
    .getRoutes()
    .filter((r) => r.meta.tabBar)
    .sort((a, b) => (Number(a.meta.order) || 0) - (Number(b.meta.order) || 0))
    .map((r) => {
      const tabBar = r.meta.tabBar as { label: string; icon: 'home' | 'movimientos' | 'cuentas' | 'menu' }
      return { name: r.name, to: r.path, label: tabBar.label, icon: tabBar.icon }
    }),
)

const middle = computed(() => Math.ceil(tabs.value.length / 2))
const leftTabs = computed(() => tabs.value.slice(0, middle.value))
const rightTabs = computed(() => tabs.value.slice(middle.value))

const route = useRoute()
const quickRegister = useQuickRegister()

// El panel "Registrar" nace del propio boton: se le pasa el elemento para que
// la animacion de apertura parta de su posicion y tamaño.
function openQuickRegister(event: MouseEvent) {
  quickRegister.open(event.currentTarget as Element)
}
// Badge de pendientes en "Menú" - ahi vive la pantalla real (/pendientes,
// dentro de Ajustes), para que el conteo se note aunque el usuario no este
// parado ahi.
const offlineQueue = useOfflineQueueStore()
</script>

<template>
  <nav class="bottom-tab-bar" :class="{ 'is-hidden': isAnySheetOpen }" aria-label="Navegación principal">
    <RouterLink
      v-for="tab in leftTabs"
      :key="tab.name"
      :to="tab.to"
      class="tab"
      :class="{ active: route.name === tab.name }"
    >
      <span class="tab-icon" aria-hidden="true">
        <svg v-if="tab.icon === 'home'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 11.5 12 4l9 7.5" stroke-linecap="round" stroke-linejoin="round" />
          <path d="M5.5 10v9a1 1 0 0 0 1 1H9.5a1 1 0 0 0 1-1v-4a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1v4a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-9" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        <svg v-else-if="tab.icon === 'movimientos'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M4 7h13M17 7l-3-3M17 7l-3 3" stroke-linecap="round" stroke-linejoin="round" />
          <path d="M20 17H7M7 17l3 3M7 17l3-3" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        <svg v-else-if="tab.icon === 'cuentas'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="6" width="18" height="13" rx="2" />
          <path d="M3 10h18M16 15h2" stroke-linecap="round" />
        </svg>
        <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M4 6h16M4 12h16M4 18h16" stroke-linecap="round" />
        </svg>
      </span>
      <span class="tab-label">{{ tab.label }}</span>
    </RouterLink>

    <button
      type="button"
      class="tab-create"
      aria-label="Nuevo movimiento"
      aria-haspopup="dialog"
      @click="openQuickRegister"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" aria-hidden="true">
        <path d="M12 5v14M5 12h14" stroke-linecap="round" />
      </svg>
    </button>

    <RouterLink
      v-for="tab in rightTabs"
      :key="tab.name"
      :to="tab.to"
      class="tab"
      :class="{ active: route.name === tab.name }"
    >
      <span class="tab-icon" aria-hidden="true">
        <svg v-if="tab.icon === 'cuentas'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="6" width="18" height="13" rx="2" />
          <path d="M3 10h18M16 15h2" stroke-linecap="round" />
        </svg>
        <!-- 'menu' y cualquier icono futuro sin SVG propio todavia caen aca
             (3 lineas horizontales) - agregar uno nuevo real es sumar un
             v-else-if mas, sin tocar la logica de arriba. -->
        <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M4 6h16M4 12h16M4 18h16" stroke-linecap="round" />
        </svg>
        <span v-if="tab.icon === 'menu' && offlineQueue.pendingCount > 0" class="tab-pending-badge">
          {{ offlineQueue.pendingCount }}
        </span>
      </span>
      <span class="tab-label">{{ tab.label }}</span>
    </RouterLink>
  </nav>
</template>

<style scoped src="./bottomTabBar.css"></style>
